-- ============================================================
-- CORRECTIF : check_and_increment_feature_usage(_service) ne vérifiait
-- que le quota quotidien (enterprise_feature_quotas), jamais si le
-- super-admin avait désactivé la fonctionnalité (enterprise_features.is_enabled).
--
-- Conséquence concrète : si le super-admin coupe "publications.facebook"
-- ou "publications.tiktok" pour une entreprise après connexion, les Edge
-- Functions fb-publish-post / tiktok-publish-post / cross-post-dispatch
-- continuaient d'autoriser la publication tant que le quota du jour
-- n'était pas atteint (par défaut illimité).
--
-- Fix : les deux fonctions retournent désormais { allowed: false,
-- error: 'feature_disabled' } si une ligne enterprise_features existe
-- pour (enterprise_id, feature_key) avec is_enabled = false. Absence de
-- ligne = activé par défaut (même convention que getEnterpriseFeatures()
-- côté client).
--
-- Additif et idempotent (CREATE OR REPLACE). Exécuter dans le SQL Editor
-- de Supabase, après db_enterprise_features.sql et db_enterprise_feature_quotas.sql.
-- ============================================================

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

  IF EXISTS (
    SELECT 1 FROM enterprise_features
    WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key AND is_enabled = false
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'feature_disabled');
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
    RETURN jsonb_build_object('allowed', false, 'error', 'quota_exceeded', 'limit', v_limit, 'used', v_used, 'remaining', 0);
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

CREATE OR REPLACE FUNCTION check_and_increment_feature_usage_service(
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
  IF EXISTS (
    SELECT 1 FROM enterprise_features
    WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key AND is_enabled = false
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'feature_disabled');
  END IF;

  INSERT INTO enterprise_feature_usage (enterprise_id, feature_key, usage_date, count)
  VALUES (p_enterprise_id, p_feature_key, CURRENT_DATE, 0)
  ON CONFLICT (enterprise_id, feature_key, usage_date) DO NOTHING;

  SELECT daily_limit INTO v_limit
  FROM enterprise_feature_quotas
  WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key;

  SELECT count INTO v_used
  FROM enterprise_feature_usage
  WHERE enterprise_id = p_enterprise_id AND feature_key = p_feature_key AND usage_date = CURRENT_DATE
  FOR UPDATE;

  IF v_limit IS NOT NULL AND v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'quota_exceeded', 'limit', v_limit, 'used', v_used, 'remaining', 0);
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
