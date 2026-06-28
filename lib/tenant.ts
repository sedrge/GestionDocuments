import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";

export type TenantFilter = {
  entreprise_id?: string;
  user_id?: string;
};

export type InviteRole = "admin" | "user";

const ACTIVE_ENTREPRISE_KEY = "ACTIVE_ENTREPRISE_ID";

const DEFAULT_SUPER_ADMIN_EMAIL = "superadmin@senmoto.local";

export const getSuperAdminEmail = (): string => {
  const value = Constants.expoConfig?.extra?.superAdminEmail;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }
  return DEFAULT_SUPER_ADMIN_EMAIL;
};

export const isSuperAdmin = async (): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return user.email.toLowerCase() === getSuperAdminEmail();
};

export const getActiveEntrepriseId = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(ACTIVE_ENTREPRISE_KEY);
};

export const setActiveEntrepriseId = async (
  id: string | null,
): Promise<void> => {
  if (id) {
    await SecureStore.setItemAsync(ACTIVE_ENTREPRISE_KEY, id);
  } else {
    await SecureStore.deleteItemAsync(ACTIVE_ENTREPRISE_KEY);
  }
};

export const generateInviteToken = (): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 40 })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
};

export const createEntreprise = async (
  nom: string,
  createdBy: string,
  explicitId?: string,
) => {
  const payload: any = {
    nom,
    created_by: createdBy,
    is_active: true,
  };
  if (explicitId) {
    payload.id = explicitId;
  }
  return supabase.from("entreprises").insert([payload]).select().single();
};

export const createEntrepriseUser = async (
  entrepriseId: string,
  userId: string,
  email: string,
  role: InviteRole,
) => {
  return supabase.from("entreprise_users").insert([
    {
      entreprise_id: entrepriseId,
      user_id: userId,
      email,
      role,
      is_active: true,
    },
  ]);
};

export const createEntrepriseForNewAdmin = async (
  entrepriseName: string,
  userId: string,
  email: string,
) => {
  const entrepriseResult = await createEntreprise(
    entrepriseName,
    userId,
    userId,
  );
  if (entrepriseResult.error || !entrepriseResult.data) {
    return entrepriseResult;
  }
  const entrepriseId = entrepriseResult.data.id;
  const userResult = await createEntrepriseUser(
    entrepriseId,
    userId,
    email,
    "admin",
  );
  return userResult.error
    ? { error: userResult.error, data: entrepriseResult.data }
    : entrepriseResult;
};

export const createInvitation = async (
  entrepriseId: string,
  email: string,
  role: InviteRole,
  invitedBy: string,
) => {
  const token = generateInviteToken();
  const { data, error } = await supabase
    .from("invitations")
    .insert([
      {
        entreprise_id: entrepriseId,
        email: email.toLowerCase().trim(),
        token,
        role,
        invited_by: invitedBy,
        is_active: true,
      },
    ])
    .select()
    .single();
  return { data, error, token };
};

export const acceptInvitation = async (
  token: string,
  userId: string,
  email: string,
) => {
  const inviteToken = token.trim();
  if (!inviteToken) {
    return { error: new Error("Token d’invitation manquant") };
  }

  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", inviteToken)
    .eq("is_active", true)
    .maybeSingle();

  if (inviteError) {
    return { error: inviteError };
  }

  if (!invitation) {
    return { error: new Error("Invitation invalide ou expirée") };
  }

  if (invitation.email.toLowerCase() !== email.toLowerCase().trim()) {
    return {
      error: new Error(
        "L’email d’inscription ne correspond pas à l’invitation",
      ),
    };
  }

  const { error: insertError } = await createEntrepriseUser(
    invitation.entreprise_id,
    userId,
    email,
    invitation.role,
  );

  if (insertError) {
    return { error: insertError };
  }

  const { error: updateError } = await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString(), is_active: false })
    .eq("id", invitation.id);

  return { error: updateError };
};

export const getEntrepriseIdForCurrentUser = async (): Promise<
  string | null
> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("entreprise_users")
    .select("entreprise_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return null;
  return data?.entreprise_id ?? null;
};

export const getTenantFilter = async (): Promise<TenantFilter> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user_id: "" };

  const activeEntrepriseId = await getActiveEntrepriseId();
  const superAdmin = await isSuperAdmin();

  if (superAdmin) {
    if (activeEntrepriseId) {
      return { entreprise_id: activeEntrepriseId };
    }
    return { user_id: user.id };
  }

  if (activeEntrepriseId) {
    return { entreprise_id: activeEntrepriseId };
  }

  const entrepriseId = await getEntrepriseIdForCurrentUser();
  if (entrepriseId) {
    return { entreprise_id: entrepriseId };
  }

  return { user_id: user.id };
};

export const applyTenantFilter = (query: any, filter: TenantFilter) => {
  if (filter.entreprise_id)
    return query.eq("entreprise_id", filter.entreprise_id);
  if (filter.user_id) return query.eq("user_id", filter.user_id);
  return query;
};

export const getCurrentEntreprise = async () => {
  const activeEntrepriseId = await getActiveEntrepriseId();
  if (!activeEntrepriseId) return null;
  const { data } = await supabase
    .from("entreprises")
    .select("*")
    .eq("id", activeEntrepriseId)
    .maybeSingle();
  return data;
};

export const getCurrentEntrepriseMembership = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("entreprise_users")
    .select("*, entreprises(*)")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
};
