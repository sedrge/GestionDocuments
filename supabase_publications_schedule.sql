-- Migration : programmation des publications (publicités programmées)
-- Permet de créer une publication à l'avance et de la rendre visible
-- automatiquement à une date/heure choisie, sans action manuelle.

ALTER TABLE enterprise_publications
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Date effective de publication : la date programmée si définie,
-- sinon la date de création (comportement actuel = visible immédiatement).
ALTER TABLE enterprise_publications
  ADD COLUMN IF NOT EXISTS publish_at timestamptz
  GENERATED ALWAYS AS (COALESCE(scheduled_at, created_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_pub_publish_at
  ON enterprise_publications (publish_at DESC);

-- La lecture publique (fil d'actualité) ne doit montrer que les publications
-- déjà dues (publish_at <= maintenant). Les admins de l'entreprise gardent
-- un accès complet à leurs propres publications (y compris programmées)
-- via la policy "pub_all_admin" (FOR ALL) déjà en place.
DROP POLICY IF EXISTS "pub_select_public" ON enterprise_publications;
CREATE POLICY "pub_select_public"
  ON enterprise_publications FOR SELECT
  USING (publish_at <= now());
