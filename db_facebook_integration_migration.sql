-- ============================================================
-- MIGRATION : enterprise_facebook_pages
-- Connexion de la Page Facebook Business de chaque entreprise
-- (publication automatique des publications via l'API Graph).
-- Exécuter dans le SQL Editor de Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS enterprise_facebook_pages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id         UUID        NOT NULL UNIQUE REFERENCES enterprises(id) ON DELETE CASCADE,
  fb_page_id            VARCHAR(64) NOT NULL,
  fb_page_name          VARCHAR(255) NOT NULL,
  fb_page_access_token  TEXT        NOT NULL,
  connected_by_user_id  UUID        REFERENCES auth.users(id),
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enterprise_facebook_pages ENABLE ROW LEVEL SECURITY;

-- Les admins de l'entreprise peuvent tout faire sur leur propre connexion Facebook.
CREATE POLICY "enterprise_admin_fb_page_all" ON enterprise_facebook_pages
  FOR ALL
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
    )
  );

-- Aucune policy SELECT publique : le token ne doit jamais être lisible
-- en dehors des admins de l'entreprise (RLS) et des Edge Functions (service_role,
-- qui contourne RLS et les GRANT/REVOKE ci-dessous).

-- Le token Facebook ne doit jamais transiter par le client, même par erreur
-- (ex: un futur `select('*')`). On retire le SELECT direct sur la table pour
-- les utilisateurs authentifiés et on expose une vue sans la colonne du token.
REVOKE SELECT ON enterprise_facebook_pages FROM authenticated;

CREATE OR REPLACE VIEW enterprise_facebook_pages_public AS
  SELECT id, enterprise_id, fb_page_id, fb_page_name, connected_by_user_id, connected_at, updated_at
  FROM enterprise_facebook_pages;

ALTER VIEW enterprise_facebook_pages_public SET (security_invoker = true);
GRANT SELECT ON enterprise_facebook_pages_public TO authenticated;

-- ============================================================
-- Suivi de la publication Facebook sur enterprise_publications
-- ============================================================

ALTER TABLE enterprise_publications
  ADD COLUMN IF NOT EXISTS fb_post_id        TEXT,
  ADD COLUMN IF NOT EXISTS fb_published_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fb_publish_error  TEXT,
  ADD COLUMN IF NOT EXISTS fb_publish_status TEXT NOT NULL DEFAULT 'not_published'
    CHECK (fb_publish_status IN ('not_published', 'published', 'error'));
