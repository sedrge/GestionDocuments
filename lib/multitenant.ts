import { api } from "./api";

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
    const formData = new FormData();
    formData.append("name", params.name);
    if (params.phone) formData.append("phone", params.phone);
    if (params.email) formData.append("email", params.email);
    if (params.adminFullName)
      formData.append("admin_full_name", params.adminFullName);
    formData.append("admin_email", params.adminEmail);
    if (params.adminPhone) formData.append("admin_phone", params.adminPhone);
    formData.append("admin_password", params.adminPassword);
    if (params.latitude)
      formData.append("latitude", params.latitude.toString());
    if (params.longitude)
      formData.append("longitude", params.longitude.toString());

    if (params.logoUrl) {
      formData.append("logo", {
        uri: params.logoUrl,
        name: "logo.jpg",
        type: "image/jpeg",
      } as any);
    }

    const result = await api.createEnterprise(formData);

    return {
      success: true,
      enterprise: result.enterprise,
      code: result.enterprise.code,
      message: "Entreprise créée avec succès. En attente d'activation.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
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
    return { success: true, message: "Utilisateur créé et ajouté à l'entreprise." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime un utilisateur de l'entreprise (enterprise admin only)
 * Ne supprime pas le compte, uniquement le lien avec l'entreprise
 */
export async function removeUserFromEnterprise(userId: string, enterpriseId: string) {
  try {
    await api.removeMember(enterpriseId, userId);
    return { success: true, message: "Utilisateur retiré de l'entreprise." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
