-- ================================================================
-- Migration : Fonctionnalités par entreprise (contrôle super-admin)
-- ================================================================
-- À exécuter dans Supabase SQL Editor

-- 1. Table principale
CREATE TABLE IF NOT EXISTS enterprise_features (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  enterprise_id UUID        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  feature_key   TEXT        NOT NULL,
  is_enabled    BOOLEAN     NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enterprise_id, feature_key)
);

-- 2. Index pour les lectures fréquentes
CREATE INDEX IF NOT EXISTS idx_enterprise_features_enterprise_id
  ON enterprise_features(enterprise_id);

-- 3. Activer RLS
ALTER TABLE enterprise_features ENABLE ROW LEVEL SECURITY;

-- 4. Super-admin : accès total (lecture + écriture)
CREATE POLICY "super_admin_full_access" ON enterprise_features
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- 5. Admins et users d'une entreprise : lecture seule de leurs features
CREATE POLICY "enterprise_members_read" ON enterprise_features
  FOR SELECT
  TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
      UNION ALL
      SELECT enterprise_id FROM enterprise_users WHERE user_id = auth.uid()
    )
  );
