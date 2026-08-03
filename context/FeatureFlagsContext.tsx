import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '../lib/api';
import { useTenant } from './TenantContext';

interface FeatureFlagsContextType {
  /** Set des clés activées. undefined = aucune restriction (tout visible). */
  enabledFeatures: Set<string> | undefined;
  /** Retourne true si la feature est accessible pour l'entreprise courante. */
  isFeatureEnabled: (key: string) => boolean;
  loadingFeatures: boolean;
  refreshFeatures: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(
  undefined,
);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const { tenant, isSuperAdmin, loading: tenantLoading } = useTenant();
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string> | undefined>(
    undefined,
  );
  const [loadingFeatures, setLoadingFeatures] = useState(false);

  const loadFeatures = async () => {
    // Super-admin et utilisateurs sans entreprise voient tout
    if (isSuperAdmin || !tenant?.enterprise_id) {
      setEnabledFeatures(undefined);
      return;
    }

    setLoadingFeatures(true);
    try {
      const data = await api.getEnterpriseFeatures(tenant.enterprise_id);

      if (!data || data.length === 0) {
        // Aucune configuration → tout activé (compatibilité avec l'existant)
        setEnabledFeatures(undefined);
      } else {
        const enabled = new Set<string>(
          data
            .filter((r: any) => r.is_enabled)
            .map((r: any) => r.feature_key as string),
        );
        setEnabledFeatures(enabled);
      }
    } finally {
      setLoadingFeatures(false);
    }
  };

  useEffect(() => {
    if (!tenantLoading) {
      loadFeatures();
    }
  }, [tenant?.enterprise_id, isSuperAdmin, tenantLoading]);

  const isFeatureEnabled = (key: string): boolean => {
    if (isSuperAdmin) return true;
    if (enabledFeatures === undefined) return true;
    return enabledFeatures.has(key);
  };

  return (
    <FeatureFlagsContext.Provider
      value={{
        enabledFeatures,
        isFeatureEnabled,
        loadingFeatures,
        refreshFeatures: loadFeatures,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = (): FeatureFlagsContextType => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
};
