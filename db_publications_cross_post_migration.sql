-- ============================================================
-- MIGRATION : quota serveur pour la publication auto + sélection
-- multi-réseaux à la création + diffusion croisée différée (cron).
--
-- IMPORTANT : additif uniquement, n'affecte pas les données existantes.
-- Exécuter dans le SQL Editor de Supabase, APRÈS db_enterprise_feature_quotas.sql,
-- db_facebook_integration_migration.sql et db_social_connections_migration.sql.
-- ============================================================

-- ─── 1. Quota serveur pour la publication auto ──────────────────────────────

ALTER TABLE enterprise_publications
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false;

-- Vérifie et incrémente le quota "publications.auto" à chaque insertion
-- auto-générée, quel que soit le chemin d'insertion (pas seulement via le
-- pré-check client, contournable). auth.uid() reste celui de l'appelant :
-- c'est un GUC de session, indépendant de SECURITY DEFINER.
CREATE OR REPLACE FUNCTION enforce_auto_publication_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota JSONB;
BEGIN
  IF NEW.is_auto_generated THEN
    v_quota := check_and_increment_feature_usage(NEW.enterprise_id, 'publications.auto');
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
      RAISE EXCEPTION 'quota_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_auto_publication_quota ON enterprise_publications;
CREATE TRIGGER trg_enforce_auto_publication_quota
  BEFORE INSERT ON enterprise_publications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_auto_publication_quota();

-- ─── 2. Sélection des réseaux à la création ─────────────────────────────────

ALTER TABLE enterprise_publications
  ADD COLUMN IF NOT EXISTS selected_platforms TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE enterprise_publications
  DROP CONSTRAINT IF EXISTS selected_platforms_valid;
ALTER TABLE enterprise_publications
  ADD CONSTRAINT selected_platforms_valid
  CHECK (selected_platforms <@ ARRAY['facebook','tiktok']::text[]);

-- ─── 3. Quota "service" pour la diffusion différée (cron, sans auth.uid()) ──
-- Même logique que check_and_increment_feature_usage, mais sans vérification
-- d'appartenance (impossible en contexte service_role, sans utilisateur
-- authentifié). Réservée au service_role : jamais exposée aux clients.
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

REVOKE ALL ON FUNCTION check_and_increment_feature_usage_service(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_and_increment_feature_usage_service(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_feature_usage_service(UUID, TEXT) TO service_role;

-- ─── 4. Tâche planifiée : diffusion croisée des publications programmées ────
-- Active pg_cron/pg_net puis planifie un appel HTTP vers l'Edge Function
-- cross-post-dispatch toutes les 5 minutes. Le secret ci-dessous DOIT être
-- défini à l'identique comme secret CRON_DISPATCH_SECRET de la fonction
-- (Dashboard Supabase → Edge Functions → cross-post-dispatch → Secrets)
-- AVANT d'exécuter cette section (sinon la fonction rejettera les appels du cron).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cross-post-dispatch';

SELECT cron.schedule(
  'cross-post-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cxjqzbyhilrimjbnqjjf.supabase.co/functions/v1/cross-post-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '68d54e4882056776e0864c85f3cb6ca71506dc624f0fa3231caf45ad5a9a9038'
    ),
    body := '{}'::jsonb
  );
  $$
);
