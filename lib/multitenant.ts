import { supabase } from "./supabase";
import {
  notifySuperAdminNewEnterprise,
  notifyEnterpriseAdminActivated,
  notifyEnterpriseAdminDeactivated,
} from "./enterpriseNotifications";

/**
 * Génère un code unique pour une entreprise
 * Format: ENT-XXXXXX (où X = alphanumériques aléatoires)
 */
export function generateEnterpriseCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "ENT-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Crée une nouvelle entreprise
 */
export async function createEnterprise(params: {
  name: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  adminFullName?: string;
  adminEmail: string;
  adminPhone?: string;
  adminPassword: string;
  latitude?: number;
  longitude?: number;
}) {
  try {
    // 1. Créer le compte auth pour l'admin
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.adminEmail,
      password: params.adminPassword,
      options: {
        data: {
          full_name: params.adminFullName || "",
          phone: params.adminPhone || "",
        },
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Failed to create auth user");
    }

    // Supabase retourne un faux user (identities vide) si l'email existe déjà
    if (authData.user.identities?.length === 0) {
      throw new Error("Un compte avec cet email existe déjà.");
    }

    const adminUserId = authData.user.id;
    const code = generateEnterpriseCode();

    // 2. Créer l'entreprise + admin via RPC SECURITY DEFINER (contourne RLS)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "create_enterprise_with_admin",
      {
        p_name: params.name,
        p_code: code,
        p_phone: params.phone || "",
        p_email: params.email || "",
        p_logo_url: params.logoUrl || "",
        p_admin_user_id: adminUserId,
        p_admin_full_name: params.adminFullName || "",
        p_admin_email: params.adminEmail,
        p_admin_phone: params.adminPhone || "",
      },
    );

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    // Sauvegarder la localisation dans entreprise_parametres si fournie
    if (params.latitude !== undefined && params.longitude !== undefined) {
      const { data: entData } = await supabase
        .from("enterprises")
        .select("id")
        .eq("code", code)
        .single();

      if (entData?.id) {
        await supabase.from("entreprise_parametres").upsert(
          {
            entreprise_id: entData.id,
            localisation: `${params.latitude},${params.longitude}`,
          },
          { onConflict: "entreprise_id" },
        );
      }
    }

    // Notifier les super admins (fire-and-forget, ne bloque pas la création)
    notifySuperAdminNewEnterprise(params.name, code).catch(console.error);

    return {
      success: true,
      enterprise: rpcData,
      code: code,
      message: "Enterprise created successfully. Awaiting activation.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Assigne un utilisateur existant à une entreprise (super-admin uniquement)
 */
export async function assignUserToEnterprise(
  userId: string,
  enterpriseId: string,
  role: "user" | "enterprise_admin" = "user",
) {
  try {
    const { error } = await supabase
      .from("enterprise_users")
      .upsert(
        {
          enterprise_id: enterpriseId,
          user_id: userId,
          role: role,
          is_active: true,
        },
        { onConflict: "enterprise_id,user_id" },
      );

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère toutes les entreprises (actives et inactives) — super-admin
 */
export async function getAllEnterprises() {
  try {
    const { data, error } = await supabase
      .from("enterprises")
      .select(
        `id, name, code, email, phone, logo_url, is_active, created_at,
         enterprise_admins(full_name, email)`,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, enterprises: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message, enterprises: [] };
  }
}

/**
 * Rejoint une entreprise existante avec un code
 */
export async function joinEnterprise(params: {
  code: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}) {
  try {
    if (params.password !== params.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // 1. Vérifier que le code existe
    const { data: enterpriseData, error: enterpriseError } = await supabase
      .from("enterprises")
      .select("id, is_active")
      .eq("code", params.code.toUpperCase())
      .single();

    if (enterpriseError || !enterpriseData) {
      throw new Error("Invalid enterprise code");
    }

    // 2. Créer le compte auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          full_name: params.fullName,
          phone: params.phone,
        },
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Failed to create account");
    }

    // 3. Ajouter l'user à l'entreprise
    const { error: userError } = await supabase
      .from("enterprise_users")
      .insert({
        enterprise_id: enterpriseData.id,
        user_id: authData.user.id,
        role: "user",
        is_active: false, // À activer par l'admin
      });

    if (userError) {
      throw new Error(userError.message);
    }

    return {
      success: true,
      message: "Account created. Awaiting approval from enterprise admin.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Récupère les entreprises en attente d'activation (pour super-admin)
 */
export async function getPendingEnterprises() {
  try {
    const { data, error } = await supabase
      .from("enterprises")
      .select(
        `
        id,
        name,
        code,
        phone,
        created_at,
        enterprise_admins(full_name, email, phone)
      `,
      )
      .eq("is_active", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return {
      success: true,
      enterprises: data || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      enterprises: [],
    };
  }
}

/**
 * Récupère les entreprises actives (pour super-admin)
 */
export async function getActiveEnterprises() {
  try {
    const { data, error } = await supabase
      .from("enterprises")
      .select(
        `
        id,
        name,
        code,
        logo_url,
        phone,
        created_at,
        enterprise_admins(full_name, email)
      `,
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return {
      success: true,
      enterprises: data || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      enterprises: [],
    };
  }
}

/**
 * Active une entreprise (super-admin only)
 */
export async function activateEnterprise(enterpriseId: string, enterpriseName?: string) {
  try {
    const { error } = await supabase
      .from("enterprises")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", enterpriseId);

    if (error) throw error;

    if (enterpriseName) {
      notifyEnterpriseAdminActivated(enterpriseId, enterpriseName).catch(console.error);
    }

    return { success: true, message: "Enterprise activated" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Désactive une entreprise (super-admin only)
 */
export async function deactivateEnterprise(enterpriseId: string, enterpriseName?: string) {
  try {
    const { error } = await supabase
      .from("enterprises")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", enterpriseId);

    if (error) throw error;

    if (enterpriseName) {
      notifyEnterpriseAdminDeactivated(enterpriseId, enterpriseName).catch(console.error);
    }

    return { success: true, message: "Enterprise deactivated" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les users en attente d'activation pour une entreprise
 * Utilise une RPC SECURITY DEFINER car auth.users n'est pas accessible via PostgREST
 */
export async function getPendingUsers(enterpriseId: string) {
  try {
    const { data, error } = await supabase.rpc("get_enterprise_pending_users", {
      p_enterprise_id: enterpriseId,
    });

    if (error) throw error;

    return {
      success: true,
      users: data || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      users: [],
    };
  }
}

/**
 * Récupère les users actifs d'une entreprise
 * Utilise une RPC SECURITY DEFINER car auth.users n'est pas accessible via PostgREST
 */
export async function getActiveUsers(enterpriseId: string) {
  try {
    const { data, error } = await supabase.rpc("get_enterprise_active_users", {
      p_enterprise_id: enterpriseId,
    });

    if (error) throw error;

    return {
      success: true,
      users: data || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      users: [],
    };
  }
}

/**
 * Active un user (enterprise admin only)
 */
export async function activateUser(userId: string, enterpriseId: string) {
  try {
    const { error } = await supabase
      .from("enterprise_users")
      .update({ is_active: true })
      .eq("user_id", userId)
      .eq("enterprise_id", enterpriseId);

    if (error) throw error;

    return { success: true, message: "User activated" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Désactive un user (enterprise admin only)
 */
export async function deactivateUser(userId: string, enterpriseId: string) {
  try {
    const { error } = await supabase
      .from("enterprise_users")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("enterprise_id", enterpriseId);

    if (error) throw error;

    return { success: true, message: "User deactivated" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée un utilisateur et l'ajoute directement à l'entreprise (enterprise admin)
 * Sauvegarde et restaure la session admin après la création
 */
export async function createUserInEnterprise(params: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  enterpriseId: string;
}) {
  try {
    // Sauvegarder la session admin courante
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    // Créer le compte du nouvel utilisateur
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          full_name: params.fullName,
          phone: params.phone || "",
        },
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Échec de la création du compte");
    }

    if (authData.user.identities?.length === 0) {
      throw new Error("Un compte avec cet email existe déjà.");
    }

    const newUserId = authData.user.id;

    // Restaurer la session admin avant d'écrire dans la DB
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }

    // Ajouter l'utilisateur à l'entreprise via RPC SECURITY DEFINER
    // (contourne le RLS qui bloquerait un INSERT direct quand auth.uid() != user_id)
    const { error: insertError } = await supabase.rpc("add_user_to_enterprise", {
      p_enterprise_id: params.enterpriseId,
      p_user_id: newUserId,
      p_role: "user",
      p_is_active: true,
    });

    if (insertError) throw new Error(insertError.message);

    return { success: true, message: "Utilisateur créé et ajouté à l'entreprise." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime un utilisateur de l'entreprise (enterprise admin only)
 * Ne supprime pas le compte auth, uniquement le lien avec l'entreprise
 */
export async function removeUserFromEnterprise(userId: string, enterpriseId: string) {
  try {
    const { error } = await supabase
      .from("enterprise_users")
      .delete()
      .eq("user_id", userId)
      .eq("enterprise_id", enterpriseId);

    if (error) throw error;

    return { success: true, message: "Utilisateur retiré de l'entreprise." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
