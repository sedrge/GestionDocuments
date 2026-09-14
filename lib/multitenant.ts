import { api } from "./api";
import { localUriToFormFile } from "./formUpload";

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
    let payload: FormData | Record<string, string | undefined>;

    payload = {
      name: params.name,
      phone: params.phone,
      email: params.email,
      admin_full_name: params.adminFullName,
      admin_email: params.adminEmail,
      admin_phone: params.adminPhone,
      admin_password: params.adminPassword,
      latitude: params.latitude?.toString(),
      longitude: params.longitude?.toString(),
    };

    const result = await api.createEnterprise(payload);

    return {
      success: true,
      enterprise: result.enterprise,
      code: result.enterprise.code,
      adminEmail: params.adminEmail,
      message: "Entreprise créée avec succès. En attente d'activation.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function uploadEnterpriseLogo(
  enterpriseId: string,
  logoUri: string,
): Promise<{ success: boolean; enterprise?: any; error?: string }> {
  try {
    const form = new FormData();
    form.append("logo", localUriToFormFile(logoUri, "logo") as any);
    const data = await api.uploadEnterpriseLogo(enterpriseId, form);
    return { success: true, enterprise: data?.enterprise ?? data };
  } catch (error: any) {
    return { success: false, error: error.message };
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
    await api.register({
      enterprise_code: params.code,
      name: params.fullName,
      email: params.email,
      phone: params.phone,
      password: params.password,
      password_confirmation: params.confirmPassword,
    });

    return {
      success: true,
      message: "Compte créé. En attente d'approbation par l'administrateur.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Reshape une ligne enterprise_users (avec la relation `user` chargée côté
 * Laravel) vers le format attendu par les écrans admin.
 */
function mapMember(m: any) {
  return {
    id: m.id,
    user_id: m.user_id,
    full_name: m.user?.name ?? "",
    email: m.user?.email ?? "",
    phone: m.user?.phone ?? undefined,
  };
}

/**
 * Reshape une entreprise (avec la relation `admins` chargée côté Laravel)
 * vers le format attendu par admin/enterprises.tsx (clé `enterprise_admins`,
 * héritée de l'ancien schéma Supabase).
 */
function mapEnterprise(e: any) {
  return { ...e, enterprise_admins: e.admins ?? [] };
}

/**
 * Récupère les entreprises en attente d'activation (pour super-admin)
 */
export async function getPendingEnterprises() {
  try {
    const data = await api.listPendingEnterprises();
    return { success: true, enterprises: (data || []).map(mapEnterprise) };
  } catch (error: any) {
    return { success: false, error: error.message, enterprises: [] };
  }
}

/**
 * Récupère les entreprises actives (pour super-admin)
 */
export async function getActiveEnterprises() {
  try {
    const data = await api.listActiveEnterprisesDetailed();
    return { success: true, enterprises: (data || []).map(mapEnterprise) };
  } catch (error: any) {
    return { success: false, error: error.message, enterprises: [] };
  }
}

/**
 * Active une entreprise (super-admin only)
 */
export async function activateEnterprise(enterpriseId: string) {
  try {
    await api.activateEnterprise(enterpriseId);
    return { success: true, message: "Entreprise activée" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Désactive une entreprise (super-admin only)
 */
export async function deactivateEnterprise(enterpriseId: string) {
  try {
    await api.deactivateEnterprise(enterpriseId);
    return { success: true, message: "Entreprise désactivée" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Supprime une entreprise et ses ressources (super-admin only). */
export async function deleteEnterprise(enterpriseId: string) {
  try {
    await api.deleteEnterprise(enterpriseId);
    return { success: true, message: "Entreprise supprimée" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function regenerateEnterpriseCode(enterpriseId: string) {
  try {
    const data = await api.regenerateEnterpriseCode(enterpriseId);
    return { success: true, code: data.code, enterprise: data.enterprise };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les users en attente d'activation pour une entreprise
 */
export async function getPendingUsers(enterpriseId: string) {
  try {
    const data = await api.listPendingMembers(enterpriseId);
    return { success: true, users: (data || []).map(mapMember) };
  } catch (error: any) {
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * Récupère les users actifs d'une entreprise
 */
export async function getActiveUsers(enterpriseId: string) {
  try {
    const data = await api.listActiveMembers(enterpriseId);
    return { success: true, users: (data || []).map(mapMember) };
  } catch (error: any) {
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * Active un user (enterprise admin only)
 */
export async function activateUser(userId: string, enterpriseId: string) {
  try {
    await api.activateMember(enterpriseId, userId);
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
    await api.deactivateMember(enterpriseId, userId);
    return { success: true, message: "User deactivated" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée un utilisateur et l'ajoute directement à l'entreprise (enterprise admin)
 */
export async function createUserInEnterprise(params: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  enterpriseId: string;
}) {
  try {
    await api.createEnterpriseMember(params.enterpriseId, {
      name: params.fullName,
      email: params.email,
      phone: params.phone,
      password: params.password,
    });
    return {
      success: true,
      message: "Utilisateur créé et ajouté à l'entreprise.",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime un utilisateur de l'entreprise (enterprise admin only)
 * Ne supprime pas le compte, uniquement le lien avec l'entreprise
 */
export async function removeUserFromEnterprise(
  userId: string,
  enterpriseId: string,
) {
  try {
    await api.removeMember(enterpriseId, userId);
    return { success: true, message: "Utilisateur retiré de l'entreprise." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
