-- ============================================================
-- MIGRATION : quota serveur pour la programmation de publications
-- (feature "publications.programmation", quota déjà activable côté
-- super-admin via QUOTA_FEATURE_KEYS, mais jusqu'ici jamais imposé côté
-- base). Même principe que enforce_auto_publication_quota : la
-- vérification doit avoir lieu en base, pas seulement côté client
-- (contournable).
--
-- Additif uniquement. Exécuter dans le SQL Editor de Supabase, après
-- db_publications_cross_post_migration.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_scheduled_publication_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota JSONB;
BEGIN
  IF NEW.scheduled_at IS NOT NULL THEN
    v_quota := check_and_increment_feature_usage(NEW.enterprise_id, 'publications.programmation');
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
      RAISE EXCEPTION 'quota_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_scheduled_publication_quota ON enterprise_publications;
CREATE TRIGGER trg_enforce_scheduled_publication_quota
  BEFORE INSERT ON enterprise_publications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_scheduled_publication_quota();
