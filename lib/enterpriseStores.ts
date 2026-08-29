// lib/enterpriseStores.ts
//
// Magasins d'une entreprise. Un magasin est une entreprise enfant (ligne
// `enterprises` avec `parent_enterprise_id`) : tout ce qui existe déjà pour une
// entreprise (membres, motos, registres, écrans...) fonctionne tel quel dessus.
// Seules la liste et la création ont besoin d'endpoints dédiés ; l'activation /
// désactivation reste super-admin via `activateEnterprise`/`deactivateEnterprise`
// de lib/multitenant.ts, et la modification via les routes /enterprises/{id}.

import { api } from './api';

export type Store = {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  parent_enterprise_id: string | null;
  created_at?: string;
};

/** Le serveur peut renvoyer soit une liste paginée, soit un tableau brut. */
const asArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.stores)) return data.stores;
  return [];
};

export async function getStores(enterpriseId: string): Promise<{
  success: boolean;
  stores: Store[];
  error?: string;
}> {
  try {
    const data = await api.listEnterpriseStores(enterpriseId);
    return { success: true, stores: asArray(data) as Store[] };
  } catch (err: any) {
    return { success: false, stores: [], error: err.message };
  }
}

/**
 * Crée un magasin sous l'entreprise `enterpriseId`. Le magasin est actif
 * immédiatement (l'entreprise parente est déjà validée) ; son responsable est
 * désigné séparément, par invitation avec le rôle "admin" sur le magasin.
 */
export async function createStore(
  enterpriseId: string,
  params: {
    name: string;
    code: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
    latitude?: number;
    longitude?: number;
  },
): Promise<{ success: boolean; store?: Store; error?: string }> {
  try {
    const data = await api.createEnterpriseStore(enterpriseId, {
      name: params.name,
      code: params.code,
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.email ? { email: params.email } : {}),
      ...(params.logoUrl ? { logo_url: params.logoUrl } : {}),
      ...(params.latitude != null ? { latitude: params.latitude } : {}),
      ...(params.longitude != null ? { longitude: params.longitude } : {}),
    });
    return { success: true, store: (data?.store ?? data?.enterprise ?? data) as Store };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
