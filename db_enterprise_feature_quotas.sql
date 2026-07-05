-- ================================================================
-- Migration : Quotas quotidiens par fonctionnalité (contrôle super-admin)
-- ================================================================
-- À exécuter dans Supabase SQL Editor, après db_enterprise_features.sql
--
-- Permet au super-admin de limiter le nombre d'utilisations par jour de
-- certaines fonctionnalités (ex: publications.facebook, publications.auto,
-- assistant_ia.actif) par entreprise. daily_limit = NULL (ou pas de ligne)
-- signifie "illimité".

-- 1. Table des quotas configurés par le super-admin
CREATE TABLE IF NOT EXISTS enterprise_feature_quotas (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  enterprise_id UUID        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  feature_key   TEXT        NOT NULL,
  daily_limit   INTEGER,    -- NULL = illimité
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enterprise_id, feature_key),
  CONSTRAINT daily_limit_positive CHECK (daily_limit IS NULL OR daily_limit > 0)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_feature_quotas_enterprise_id
  ON enterprise_feature_quotas(enterprise_id);

ALTER TABLE enterprise_feature_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_quotas" ON enterprise_feature_quotas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "enterprise_members_read_quotas" ON enterprise_feature_quotas
  FOR SELECT
  TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
      UNION ALL
      SELECT enterprise_id FROM enterprise_users WHERE user_id = auth.uid()
    )
  );

-- 2. Table du compteur d'utilisation quotidien (une ligne par entreprise/feature/jour)
CREATE TABLE IF NOT EXISTS enterprise_feature_usage (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  enterprise_id UUID        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  feature_key   TEXT        NOT NULL,
  usage_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  count         INTEGER     NOT NULL DEFAULT 0,
  UNIQUE(enterprise_id, feature_key, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_feature_usage_lookup
  ON enterprise_feature_usage(enterprise_id, feature_key, usage_date);

ALTER TABLE enterprise_feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_usage" ON enterprise_feature_usage
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "enterprise_members_read_usage" ON enterprise_feature_usage
  FOR SELECT
  TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
      UNION ALL
      SELECT enterprise_id FROM enterprise_users WHERE user_id = auth.uid()
    )
  );

-- 3. Fonction atomique : vérifie le quota du jour et incrémente le compteur.
-- Autorise l'appel uniquement au super-admin ou aux membres de l'entreprise
-- concernée (ne pas se fier uniquement aux contrôles côté client).
-- Retourne un JSON : { allowed, limit, used, remaining }
CREATE OR REPLACE FUNCTION check_and_increment_feature_usage(
  p_enterprise_id UUID,
  p_feature_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM enterprise_admins WHERE user_id = auth.uid() AND enterprise_id = p_enterprise_id
    UNION ALL
    SELECT 1 FROM enterprise_users WHERE user_id = auth.uid() AND enterprise_id = p_enterprise_id
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'forbidden');
  END IF;

  -- Assure l'existence de la ligne du jour
  INSERT INTO enterprise_feature_usage (enterprise_id, feature_key, usage_date, count)
  VALUES (p_enterprise_id, p_feature_key, CURRENT_DATE, 0)
  ON CONFLICT (enterprise_id, feature_key, usage_date) DO NOTHING;

  SELECT daily_limit INTO v_limit
  FROM enterprise_feature_quotas
  WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key;

  -- Verrouille la ligne du jour pour éviter les races entre requêtes concurrentes
  SELECT count INTO v_used
  FROM enterprise_feature_usage
  WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key AND usage_date = CURRENT_DATE
  FOR UPDATE;

  IF v_limit IS NOT NULL AND v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'limit', v_limit, 'used', v_used, 'remaining', 0);
  END IF;

  UPDATE enterprise_feature_usage
  SET count = count + 1
  WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key AND usage_date = CURRENT_DATE
  RETURNING count INTO v_used;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'used', v_used,
    'remaining', CASE WHEN v_limit IS NULL THEN NULL ELSE v_limit - v_used END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_increment_feature_usage(UUID, TEXT) TO authenticated;
