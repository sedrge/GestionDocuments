import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { supabase } from "../lib/supabase";

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

export type PendingState = "enterprise_pending" | "user_pending" | "no_enterprise" | null;

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
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingState, setPendingState] = useState<PendingState>(null);

  const loadTenant = async () => {
    try {
      setLoading(true);
      setError(null);
      setPendingState(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        setIsAuthenticated(false);
        setTenant(null);
        return;
      }

      setIsAuthenticated(true);
      const userId = sessionData.session.user.id;

      // 1. Super-admin
      const { data: superAdminData } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (superAdminData) {
        setTenant({
          enterprise_id: "",
          enterprise_name: "Super-Admin",
          enterprise_code: "",
          enterprise_logo_url: null,
          user_id: userId,
          user_role: "super_admin",
          is_enterprise_active: true,
          is_user_active: true,
        });
        return;
      }

      // 2. Admin d'entreprise (actif ou en attente)
      const { data: adminData } = await supabase
        .from("enterprise_admins")
        .select(
          "enterprise_id, user_id, is_active, enterprises(id, name, code, logo_url, is_active)"
        )
        .eq("user_id", userId)
        .single();

      if (adminData && adminData.enterprises) {
        const enterprise = adminData.enterprises as any;
        setTenant({
          enterprise_id: enterprise.id,
          enterprise_name: enterprise.name,
          enterprise_code: enterprise.code,
          enterprise_logo_url: enterprise.logo_url,
          user_id: userId,
          user_role: "enterprise_admin",
          is_enterprise_active: enterprise.is_active,
          is_user_active: adminData.is_active ?? true,
        });
        if (!enterprise.is_active) {
          setPendingState("enterprise_pending");
        }
        return;
      }

      // 3. Utilisateur d'entreprise (actif ou en attente)
      const { data: userData } = await supabase
        .from("enterprise_users")
        .select(
          "enterprise_id, is_active, enterprises(id, name, code, logo_url, is_active)"
        )
        .eq("user_id", userId)
        .single();

      if (userData && userData.enterprises) {
        const enterprise = userData.enterprises as any;
        setTenant({
          enterprise_id: enterprise.id,
          enterprise_name: enterprise.name,
          enterprise_code: enterprise.code,
          enterprise_logo_url: enterprise.logo_url,
          user_id: userId,
          user_role: "user",
          is_enterprise_active: enterprise.is_active,
          is_user_active: userData.is_active,
        });
        if (!userData.is_active) {
          setPendingState("user_pending");
        } else if (!enterprise.is_active) {
          setPendingState("enterprise_pending");
        }
        return;
      }

      // Utilisateur sans entreprise
      setPendingState("no_enterprise");
      setTenant(null);
    } catch (err: any) {
      setError(err.message);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadTenant();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const isSuperAdmin = tenant?.user_role === "super_admin";
  const isEnterpriseAdmin = tenant?.user_role === "enterprise_admin";
  const isRegularUser = tenant?.user_role === "user";

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
