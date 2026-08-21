import * as SecureStore from "expo-secure-store";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getToken } from "../lib/api";

/**
 * Entreprise/magasin sélectionné, mémorisé entre deux lancements de l'app
 * (même mécanisme que `laravel_token` dans lib/api.js).
 */
const SELECTED_ENTERPRISE_KEY = "selected_enterprise_id";

export interface TenantInfo {
  enterprise_id: string;
  enterprise_name: string;
  enterprise_code: string;
  enterprise_logo_url: string | null;
  user_id: string;
  user_role: "super_admin" | "enterprise_admin" | "user";
  is_enterprise_active: boolean;
  is_user_active: boolean;
  /** Null pour une entreprise de premier niveau, renseigné pour un magasin. */
  parent_enterprise_id: string | null;
}

/**
 * Entreprise (ou magasin) sur laquelle l'utilisateur peut basculer. Construite
 * à partir de `enterprise_admin_of` (+ leurs magasins) et
 * `enterprise_member_of` renvoyés par `/auth/me`.
 */
export interface AccessibleEnterprise {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  is_active: boolean;
  parent_enterprise_id: string | null;
  role: "enterprise_admin" | "user";
  is_user_active: boolean;
}

/**
 * Normalise une entrée `/auth/me` (entreprise, magasin ou adhésion) vers
 * `AccessibleEnterprise`. Défensif à dessein : tant que `AuthController::me()`
 * ne charge pas `enterprise.stores`/`parent_enterprise_id`, les champs absents
 * doivent simplement valoir "pas de magasin"/"pas de parent" au lieu de casser.
 */
const toAccessibleEnterprise = (
  raw: any,
  role: "enterprise_admin" | "user",
  parentIdFallback: string | null = null,
): AccessibleEnterprise => ({
  id: raw?.id,
  name: raw?.name ?? "",
  code: raw?.code ?? "",
  logo_url: raw?.logo_url ?? null,
  is_active: raw?.is_active ?? true,
  parent_enterprise_id: raw?.parent_enterprise_id ?? parentIdFallback ?? null,
  role,
  // Un magasin renvoyé par la relation `stores` n'a pas de colonne
  // `is_user_active` (elle vient de la ligne d'adhésion) : l'admin parent y a
  // accès par cascade, donc actif par défaut.
  is_user_active: raw?.is_user_active ?? true,
});

const buildTenantFromAccessible = (
  entry: AccessibleEnterprise,
  userId: string,
): TenantInfo => ({
  enterprise_id: entry.id,
  enterprise_name: entry.name,
  enterprise_code: entry.code,
  enterprise_logo_url: entry.logo_url,
  user_id: userId,
  user_role: entry.role,
  is_enterprise_active: entry.is_active,
  is_user_active: entry.is_user_active,
  parent_enterprise_id: entry.parent_enterprise_id,
});

export type PendingState =
  | "enterprise_pending"
  | "user_pending"
  | "no_enterprise"
  | null;

interface TenantContextType {
  tenant: TenantInfo | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  pendingState: PendingState;
  refreshTenant: () => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isEnterpriseAdmin: boolean;
  isRegularUser: boolean;
  isImpersonating: boolean;
  startImpersonation: (enterprise_id: string, enterprise_name: string) => void;
  stopImpersonation: () => void;
  /** Entreprises + magasins accessibles à l'utilisateur connecté. */
  accessibleEnterprises: AccessibleEnterprise[];
  /** Bascule vers une entreprise/magasin accessible et mémorise le choix. */
  switchTenant: (enterpriseId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [realTenant, setRealTenant] = useState<TenantInfo | null>(null);
  const [impersonation, setImpersonation] = useState<{
    enterprise_id: string;
    enterprise_name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingState, setPendingState] = useState<PendingState>(null);
  const [accessibleEnterprises, setAccessibleEnterprises] = useState<
    AccessibleEnterprise[]
  >([]);

  const loadTenant = async () => {
    try {
      setLoading(true);
      setError(null);
      setPendingState(null);

      const token = await getToken();
      if (!token) {
        setIsAuthenticated(false);
        setRealTenant(null);
        return;
      }

      const userData = await api.me();
      setIsAuthenticated(true);

      const user = userData.user;

      if (userData.is_super_admin) {
        setAccessibleEnterprises([]);
        setRealTenant({
          enterprise_id: "",
          enterprise_name: "Super-Admin",
          enterprise_code: "",
          enterprise_logo_url: null,
          user_id: user.id,
          user_role: "super_admin",
          is_enterprise_active: true,
          is_user_active: true,
          parent_enterprise_id: null,
        });
        return;
      }

      // 1 bis. Liste des entreprises/magasins accessibles (purement additif :
      // n'influence le tenant par défaut que si un choix a été mémorisé).
      const adminEntries: any[] = Array.isArray(userData.enterprise_admin_of)
        ? userData.enterprise_admin_of
        : [];
      const memberEntries: any[] = Array.isArray(userData.enterprise_member_of)
        ? userData.enterprise_member_of
        : [];

      const accessibleById = new Map<string, AccessibleEnterprise>();
      const pushAccessible = (entry: AccessibleEnterprise) => {
        if (!entry.id || accessibleById.has(entry.id)) return;
        accessibleById.set(entry.id, entry);
      };

      adminEntries.forEach((entry: any) => {
        pushAccessible(toAccessibleEnterprise(entry, "enterprise_admin"));
        // `stores` n'existe que si AuthController::me() l'a chargé en eager
        // load ; sinon aucun magasin n'est listé, sans erreur.
        const stores: any[] = Array.isArray(entry?.stores) ? entry.stores : [];
        stores.forEach((store: any) =>
          pushAccessible(
            toAccessibleEnterprise(store, "enterprise_admin", entry?.id ?? null),
          ),
        );
      });
      memberEntries.forEach((entry: any) =>
        pushAccessible(toAccessibleEnterprise(entry, "user")),
      );

      const accessible = Array.from(accessibleById.values());
      setAccessibleEnterprises(accessible);

      // 1 ter. Choix mémorisé, s'il est toujours valide.
      let storedId: string | null = null;
      try {
        storedId = await SecureStore.getItemAsync(SELECTED_ENTERPRISE_KEY);
      } catch {
        storedId = null;
      }
      const stored = storedId
        ? accessible.find((entry) => entry.id === storedId)
        : undefined;
      if (stored) {
        setRealTenant(buildTenantFromAccessible(stored, user.id));
        if (!stored.is_user_active) {
          setPendingState("user_pending");
        } else if (!stored.is_active) {
          setPendingState("enterprise_pending");
        }
        return;
      }

      // 2. Admin d'entreprise
      if (
        userData.enterprise_admin_of &&
        userData.enterprise_admin_of.length > 0
      ) {
        const enterprise = userData.enterprise_admin_of[0];
        setRealTenant({
          enterprise_id: enterprise.id,
          enterprise_name: enterprise.name,
          enterprise_code: enterprise.code,
          enterprise_logo_url: enterprise.logo_url,
          user_id: user.id,
          user_role: "enterprise_admin",
          is_enterprise_active: enterprise.is_active,
          is_user_active: enterprise.is_user_active,
          parent_enterprise_id: enterprise.parent_enterprise_id ?? null,
        });
        if (!enterprise.is_user_active) {
          setPendingState("user_pending");
        } else if (!enterprise.is_active) {
          setPendingState("enterprise_pending");
        }
        return;
      }

      // 3. Membre d'entreprise
      if (
        userData.enterprise_member_of &&
        userData.enterprise_member_of.length > 0
      ) {
        const enterprise = userData.enterprise_member_of[0];
        setRealTenant({
          enterprise_id: enterprise.id,
          enterprise_name: enterprise.name,
          enterprise_code: enterprise.code,
          enterprise_logo_url: enterprise.logo_url,
          user_id: user.id,
          user_role: "user",
          is_enterprise_active: enterprise.is_active,
          is_user_active: enterprise.is_user_active,
          parent_enterprise_id: enterprise.parent_enterprise_id ?? null,
        });
        if (!enterprise.is_user_active) {
          setPendingState("user_pending");
        } else if (!enterprise.is_active) {
          setPendingState("enterprise_pending");
        }
        return;
      }

      // Utilisateur sans entreprise
      setPendingState("no_enterprise");
      setRealTenant(null);
    } catch (err: any) {
      setError(err.message);
      setRealTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
  }, []);

  // Réinitialise immédiatement l'état d'authentification en mémoire — sans
  // ça, isAuthenticated reste `true` après un logout (loadTenant() n'est
  // sinon rejoué qu'au montage de l'app), et RouteGuard laisse l'utilisateur
  // revenir sur les écrans authentifiés jusqu'à un redémarrage complet.
  const logout = async () => {
    await api.logout();
    // Le magasin/entreprise sélectionné est propre à la session : le garder
    // ferait revenir le prochain utilisateur sur un tenant qui n'est pas le
    // sien (il serait ignoré faute d'être dans sa liste, mais autant nettoyer).
    try {
      await SecureStore.deleteItemAsync(SELECTED_ENTERPRISE_KEY);
    } catch {
      // Clé absente ou stockage indisponible : sans conséquence.
    }
    setIsAuthenticated(false);
    setRealTenant(null);
    setPendingState(null);
    setImpersonation(null);
    setAccessibleEnterprises([]);
  };

  /**
   * Bascule vers une autre entreprise/magasin accessible. Volontairement
   * indépendant de l'impersonation super-admin : ni l'un ni l'autre ne
   * réinitialise l'état de l'autre.
   */
  const switchTenant = async (enterpriseId: string) => {
    const entry = accessibleEnterprises.find((e) => e.id === enterpriseId);
    if (!entry) return;

    setRealTenant(buildTenantFromAccessible(entry, realTenant?.user_id ?? ""));
    setPendingState(
      !entry.is_user_active
        ? "user_pending"
        : !entry.is_active
          ? "enterprise_pending"
          : null,
    );

    try {
      await SecureStore.setItemAsync(SELECTED_ENTERPRISE_KEY, enterpriseId);
    } catch {
      // Le basculement en mémoire reste valable même si la persistance échoue.
    }
  };

  // Impersonation — super admin emprunte l'identité d'une entreprise
  const isSuperAdmin = realTenant?.user_role === "super_admin";
  const isImpersonating = !!impersonation && isSuperAdmin;

  // tenant effectif : si impersonation active, on surcharge enterprise_id/name
  const tenant: TenantInfo | null = isImpersonating
    ? {
        ...realTenant!,
        enterprise_id: impersonation!.enterprise_id,
        enterprise_name: impersonation!.enterprise_name,
      }
    : realTenant;

  const startImpersonation = (
    enterprise_id: string,
    enterprise_name: string,
  ) => {
    setImpersonation({ enterprise_id, enterprise_name });
  };

  const stopImpersonation = () => {
    setImpersonation(null);
  };

  const isEnterpriseAdmin = realTenant?.user_role === "enterprise_admin";
  const isRegularUser = realTenant?.user_role === "user";

  return (
    <TenantContext.Provider
      value={{
        tenant,
        loading,
        error,
        isAuthenticated,
        pendingState,
        refreshTenant: loadTenant,
        logout,
        isSuperAdmin,
        isEnterpriseAdmin,
        isRegularUser,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
        accessibleEnterprises,
        switchTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return context;
};
