-- ============================================================
-- MIGRATION : modèle générique multi-plateformes pour la publication
-- automatique des publications (TikTok en premier, extensible ensuite).
--
-- IMPORTANT : n'affecte PAS enterprise_facebook_pages ni les colonnes fb_*
-- de enterprise_publications, déjà en production et utilisées par de vraies
-- entreprises. Ce fichier est purement additif.
-- Exécuter dans le SQL Editor de Supabase.
-- ============================================================

-- ─── Connexions par entreprise et par plateforme (hors Facebook) ────────────
CREATE TABLE IF NOT EXISTS enterprise_social_connections (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id             UUID        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  platform                  TEXT        NOT NULL CHECK (platform IN ('tiktok')),
  external_account_id       TEXT        NOT NULL,
  external_account_name     TEXT,
  access_token              TEXT        NOT NULL,
  refresh_token             TEXT        NOT NULL,
  access_token_expires_at   TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at  TIMESTAMPTZ NOT NULL,
  connected_by_user_id      UUID        REFERENCES auth.users(id),
  connected_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enterprise_id, platform)
);

ALTER TABLE enterprise_social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_admin_social_all" ON enterprise_social_connections
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

-- Même précaution que pour enterprise_facebook_pages : les tokens ne doivent
-- jamais transiter par le client, même via un futur select('*') maladroit.
--
-- La vue ci-dessous est en security_invoker = true : Postgres vérifie donc
-- aussi les droits de l'appelant sur la table de base, pas seulement sur la
-- vue. Un simple REVOKE bloquerait alors aussi l'accès via la vue. On
-- accorde à la place un GRANT SELECT limité aux colonnes sûres (sans les
-- tokens) : select('*') reste bloqué, la vue restreinte fonctionne.
REVOKE SELECT ON enterprise_social_connections FROM authenticated;
GRANT SELECT (
  id, enterprise_id, platform, external_account_name,
  connected_by_user_id, connected_at, updated_at
) ON enterprise_social_connections TO authenticated;

CREATE OR REPLACE VIEW enterprise_social_connections_public AS
  SELECT id, enterprise_id, platform, external_account_name, connected_by_user_id, connected_at, updated_at
  FROM enterprise_social_connections;

ALTER VIEW enterprise_social_connections_public SET (security_invoker = true);
GRANT SELECT ON enterprise_social_connections_public TO authenticated;

-- ─── Statut de publication par plateforme et par publication ────────────────
-- Facebook garde ses colonnes fb_* sur enterprise_publications (inchangées) ;
-- cette table générique sert aux nouvelles plateformes (TikTok, puis futures).
CREATE TABLE IF NOT EXISTS publication_platform_status (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id   UUID        NOT NULL REFERENCES enterprise_publications(id) ON DELETE CASCADE,
  platform         TEXT        NOT NULL CHECK (platform IN ('tiktok')),
  external_post_id TEXT,
  status           TEXT        NOT NULL DEFAULT 'not_published'
    CHECK (status IN ('not_published', 'published', 'error')),
  error_message    TEXT,
  published_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(publication_id, platform)
);

ALTER TABLE publication_platform_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_admin_platform_status_all" ON publication_platform_status
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enterprise_publications p
      JOIN enterprise_admins a ON a.enterprise_id = p.enterprise_id
      WHERE p.id = publication_platform_status.publication_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enterprise_publications p
      JOIN enterprise_admins a ON a.enterprise_id = p.enterprise_id
      WHERE p.id = publication_platform_status.publication_id AND a.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_platform_status_publication
  ON publication_platform_status(publication_id);
