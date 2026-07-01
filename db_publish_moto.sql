-- Migration : ajout du champ is_published sur la table motos
-- Par défaut false : les motos ne sont pas publiées sur la vitrine

ALTER TABLE motos
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Index pour accélérer le filtre sur la vitrine publique
CREATE INDEX IF NOT EXISTS motos_published_idx
  ON motos (is_published, created_at DESC)
  WHERE is_published = true;

-- RLS : la politique de lecture existante (select_own) reste inchangée pour le propriétaire.
-- La vitrine publique doit pouvoir lire les motos publiées même sans authentification.
-- Si la RLS est activée sur motos, on ajoute une politique publique :
DROP POLICY IF EXISTS motos_select_published ON motos;
CREATE POLICY motos_select_published ON motos
  FOR SELECT
  USING (is_published = true);
