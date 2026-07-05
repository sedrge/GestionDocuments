import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FeatureItem = {
  key: string;
  label: string;
  icon: string;
  description: string;
  /** Si true, le super-admin peut fixer une limite d'utilisation par jour pour cette feature. */
  hasQuota?: boolean;
};

export type FeatureSection = {
  id: string;
  label: string;
  icon: string;
  items: FeatureItem[];
};

// ── Registre complet de toutes les fonctionnalités contrôlables ───────────────
// Chaque clé (key) correspond à une fonctionnalité précise de l'application.
// Le super-admin active/désactive ces clés par entreprise selon le plan payé.

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: 'documents',
    label: 'Documents & Fichiers',
    icon: 'folder-outline',
    items: [
      {
        key: 'documents.dossiers',
        label: 'Dossiers & Documents',
        icon: 'folder-outline',
        description: 'Créer et gérer des dossiers de documents',
      },
      {
        key: 'documents.import',
        label: 'Import de fichiers',
        icon: 'document-attach-outline',
        description: 'Importer des fichiers depuis le stockage',
      },
      {
        key: 'documents.photo',
        label: 'Prise de photo',
        icon: 'camera-outline',
        description: 'Capturer des photos via la caméra',
      },
      {
        key: 'documents.video',
        label: 'Enregistrement vidéo',
        icon: 'videocam-outline',
        description: 'Filmer des vidéos via la caméra',
      },
    ],
  },
  {
    id: 'registres',
    label: 'Registres',
    icon: 'clipboard-outline',
    items: [
      {
        key: 'registres.actif',
        label: 'Module Registres',
        icon: 'clipboard-outline',
        description: 'Accès complet au module de registres',
      },
    ],
  },
  {
    id: 'decharges',
    label: 'Décharges',
    icon: 'document-text-outline',
    items: [
      {
        key: 'decharges.actif',
        label: 'Module Décharges',
        icon: 'document-text-outline',
        description: 'Accès complet au module de décharges',
      },
    ],
  },
  {
    id: 'motos',
    label: 'Gestion Motos',
    icon: 'bicycle-outline',
    items: [
      {
        key: 'motos.liste',
        label: 'Inventaire Motos',
        icon: 'bicycle-outline',
        description: 'Liste, ajout et gestion des motos',
      },
      {
        key: 'motos.catalogue',
        label: 'Catalogue',
        icon: 'albums-outline',
        description: 'Catalogue des modèles de motos',
      },
      {
        key: 'motos.vitrine',
        label: 'Vitrine Publique',
        icon: 'globe-outline',
        description: 'Publier des motos sur la vitrine publique du fil d\'actualité',
      },
    ],
  },
  {
    id: 'ventes',
    label: 'Ventes',
    icon: 'bag-check-outline',
    items: [
      {
        key: 'ventes.actif',
        label: 'Module Ventes',
        icon: 'bag-check-outline',
        description: 'Créer et suivre les ventes',
      },
    ],
  },
  {
    id: 'recus',
    label: 'Reçus',
    icon: 'receipt-outline',
    items: [
      {
        key: 'recus.actif',
        label: 'Module Reçus',
        icon: 'receipt-outline',
        description: 'Génération et gestion des reçus',
      },
    ],
  },
  {
    id: 'rendezvous',
    label: 'Rendez-vous',
    icon: 'calendar-outline',
    items: [
      {
        key: 'rendezvous.actif',
        label: 'Module Rendez-vous',
        icon: 'calendar-outline',
        description: 'Planning et gestion des rendez-vous',
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: 'chatbubbles-outline',
    items: [
      {
        key: 'chat.actif',
        label: 'Chat & Messagerie',
        icon: 'chatbubbles-outline',
        description: 'Messagerie interne et avec les clients',
      },
      {
        key: 'notifications.actif',
        label: 'Notifications Push',
        icon: 'notifications-outline',
        description: 'Système de notifications push',
      },
      {
        key: 'contacts.actif',
        label: 'Page de Contact',
        icon: 'call-outline',
        description: 'Gestion des contacts et demandes',
      },
    ],
  },
  {
    id: 'avance',
    label: 'Fonctionnalités Avancées',
    icon: 'rocket-outline',
    items: [
      {
        key: 'assistant_ia.actif',
        label: 'Assistant IA',
        icon: 'sparkles-outline',
        description: 'Assistant intelligent intégré',
        hasQuota: true,
      },
      {
        key: 'publications.actif',
        label: 'Publications',
        icon: 'newspaper-outline',
        description: 'Fil d\'actualités et publications',
      },
      {
        key: 'publications.auto',
        label: 'Génération Automatique',
        icon: 'flash-outline',
        description: 'Génération automatique de publicités depuis le stock de motos',
        hasQuota: true,
      },
      {
        key: 'publications.programmation',
        label: 'Publications Programmées',
        icon: 'alarm-outline',
        description: 'Planifier une date et une heure de publication automatique',
      },
      {
        key: 'publications.facebook',
        label: 'Publication sur Facebook',
        icon: 'logo-facebook',
        description: 'Connecter la Page Facebook de l\'entreprise et publier automatiquement les publications',
        hasQuota: true,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Outils Administration',
    icon: 'shield-outline',
    items: [
      {
        key: 'rapports.actif',
        label: 'Rapports & Export',
        icon: 'document-text-outline',
        description: 'Statistiques, rapports et exports',
      },
      {
        key: 'stock.actif',
        label: 'Gestion du Stock',
        icon: 'layers-outline',
        description: 'Vue et gestion du stock de motos',
      },
      {
        key: 'audit.actif',
        label: 'Journal d\'Audit',
        icon: 'time-outline',
        description: 'Traçabilité complète des actions',
      },
    ],
  },
  {
    id: 'parametres',
    label: 'Paramètres Entreprise',
    icon: 'cog-outline',
    items: [
      {
        key: 'parametres.logo',
        label: 'Personnalisation Logo',
        icon: 'image-outline',
        description: 'Changer le logo de l\'application',
      },
      {
        key: 'parametres.entete',
        label: 'Entête Facture',
        icon: 'business-outline',
        description: 'Configurer l\'entête des factures',
      },
      {
        key: 'parametres.pin',
        label: 'Sécurité PIN',
        icon: 'keypad-outline',
        description: 'Gestion du code PIN de sécurité',
      },
    ],
  },
];

export const ALL_FEATURE_KEYS = FEATURE_SECTIONS.flatMap((s) =>
  s.items.map((i) => i.key),
);

/** Clés des features pour lesquelles le super-admin peut fixer un quota quotidien. */
export const QUOTA_FEATURE_KEYS = FEATURE_SECTIONS.flatMap((s) =>
  s.items.filter((i) => i.hasQuota).map((i) => i.key),
);

// ── Fonctions DB ──────────────────────────────────────────────────────────────

/**
 * Récupère les features configurées pour une entreprise.
 * Retourne null si aucune configuration (= toutes activées par défaut).
 */
export async function getEnterpriseFeatures(enterpriseId: string): Promise<{
  success: boolean;
  features: Record<string, boolean> | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('enterprise_features')
      .select('feature_key, is_enabled')
      .eq('enterprise_id', enterpriseId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { success: true, features: null };
    }

    const features: Record<string, boolean> = {};
    data.forEach((row) => {
      features[row.feature_key] = row.is_enabled;
    });

    return { success: true, features };
  } catch (err: any) {
    return { success: false, features: null, error: err.message };
  }
}

/**
 * Sauvegarde la configuration des features pour une entreprise (super-admin).
 * Remplace toute la configuration existante.
 */
export async function setEnterpriseFeatures(
  enterpriseId: string,
  features: Record<string, boolean>,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Supprimer l'ancienne configuration
    await supabase
      .from('enterprise_features')
      .delete()
      .eq('enterprise_id', enterpriseId);

    // Insérer la nouvelle configuration
    const rows = Object.entries(features).map(([feature_key, is_enabled]) => ({
      enterprise_id: enterpriseId,
      feature_key,
      is_enabled,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('enterprise_features')
      .insert(rows);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Active toutes les fonctionnalités d'un coup pour une entreprise.
 */
export async function enableAllFeatures(
  enterpriseId: string,
): Promise<{ success: boolean; error?: string }> {
  const allEnabled = Object.fromEntries(
    ALL_FEATURE_KEYS.map((key) => [key, true]),
  );
  return setEnterpriseFeatures(enterpriseId, allEnabled);
}

/**
 * Désactive toutes les fonctionnalités d'un coup pour une entreprise.
 */
export async function disableAllFeatures(
  enterpriseId: string,
): Promise<{ success: boolean; error?: string }> {
  const allDisabled = Object.fromEntries(
    ALL_FEATURE_KEYS.map((key) => [key, false]),
  );
  return setEnterpriseFeatures(enterpriseId, allDisabled);
}

// ── Quotas d'utilisation quotidienne ───────────────────────────────────────────
// Pour certaines features (voir `hasQuota` dans FEATURE_SECTIONS), le super-admin
// peut fixer un nombre maximum d'utilisations par jour. `daily_limit` = null (ou
// absence de ligne) signifie "illimité".

export const QUOTA_EXCEEDED_MESSAGE =
  "Quota quotidien atteint pour cette fonctionnalité. Contactez le concepteur pour passer en mode illimité.";

export type QuotaCheckResult = {
  allowed: boolean;
  limit?: number | null;
  used?: number;
  remaining?: number | null;
  error?: string;
};

/**
 * Récupère les limites quotidiennes configurées pour une entreprise.
 * Une clé absente du résultat signifie "illimité".
 */
export async function getEnterpriseQuotas(enterpriseId: string): Promise<{
  success: boolean;
  quotas: Record<string, number | null>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('enterprise_feature_quotas')
      .select('feature_key, daily_limit')
      .eq('enterprise_id', enterpriseId);

    if (error) throw error;

    const quotas: Record<string, number | null> = {};
    (data ?? []).forEach((row) => {
      quotas[row.feature_key] = row.daily_limit;
    });

    return { success: true, quotas };
  } catch (err: any) {
    return { success: false, quotas: {}, error: err.message };
  }
}

/**
 * Fixe (ou supprime, si dailyLimit = null) la limite quotidienne d'une feature
 * pour une entreprise. dailyLimit = null => illimité.
 */
export async function setEnterpriseQuota(
  enterpriseId: string,
  featureKey: string,
  dailyLimit: number | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('enterprise_feature_quotas').upsert(
      {
        enterprise_id: enterpriseId,
        feature_key: featureKey,
        daily_limit: dailyLimit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'enterprise_id,feature_key' },
    );

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Récupère le nombre d'utilisations déjà comptabilisées aujourd'hui, par feature,
 * pour affichage dans le dashboard super-admin.
 */
export async function getEnterpriseUsageToday(enterpriseId: string): Promise<{
  success: boolean;
  usage: Record<string, number>;
  error?: string;
}> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('enterprise_feature_usage')
      .select('feature_key, count')
      .eq('enterprise_id', enterpriseId)
      .eq('usage_date', today);

    if (error) throw error;

    const usage: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      usage[row.feature_key] = row.count;
    });

    return { success: true, usage };
  } catch (err: any) {
    return { success: false, usage: {}, error: err.message };
  }
}

/**
 * Vérifie de façon atomique (côté DB) si l'entreprise peut encore utiliser la
 * feature aujourd'hui, et incrémente son compteur d'utilisation si c'est le cas.
 * À appeler juste avant d'exécuter l'action réelle (publication, génération, etc).
 */
export async function checkAndIncrementFeatureUsage(
  enterpriseId: string,
  featureKey: string,
): Promise<QuotaCheckResult> {
  try {
    const { data, error } = await supabase.rpc('check_and_increment_feature_usage', {
      p_enterprise_id: enterpriseId,
      p_feature_key: featureKey,
    });

    if (error) throw error;

    return data as QuotaCheckResult;
  } catch (err: any) {
    return { allowed: false, error: err.message };
  }
}
