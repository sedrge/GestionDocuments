import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getToken } from "../lib/api";

export interface TenantInfo {
  enterprise_id: string;
  enterprise_name: string;
  enterprise_code: string;
  enterprise_logo_url: string | null;
  user_id: string;
  user_role: "super_admin" | "enterprise_admin" | "user";
  is_enterprise_active: boolean;
  is_user_active: boolean;
}

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
  isSuperAdmin: boolean;
  isEnterpriseAdmin: boolean;
  isRegularUser: boolean;
  isImpersonating: boolean;
  startImpersonation: (enterprise_id: string, enterprise_name: string) => void;
  stopImpersonation: () => void;
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
        setRealTenant({
          enterprise_id: "",
          enterprise_name: "Super-Admin",
          enterprise_code: "",
          enterprise_logo_url: null,
          user_id: user.id,
          user_role: "super_admin",
          is_enterprise_active: true,
          is_user_active: true,
        });
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
        isSuperAdmin,
        isEnterpriseAdmin,
        isRegularUser,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
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
