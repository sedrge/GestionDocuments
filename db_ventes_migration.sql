-- ============================================================
-- Migration : Ajout des champs de vente à la table motos
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajout des colonnes
ALTER TABLE motos
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS date_vente TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nom_acheteur TEXT,
  ADD COLUMN IF NOT EXISTS telephone_acheteur TEXT,
  ADD COLUMN IF NOT EXISTS notes_vente TEXT,
  ADD COLUMN IF NOT EXISTS prix_vente_final NUMERIC;

-- 2. Contrainte sur les valeurs de statut
ALTER TABLE motos
  DROP CONSTRAINT IF EXISTS motos_statut_check;

ALTER TABLE motos
  ADD CONSTRAINT motos_statut_check
  CHECK (statut IN ('disponible', 'vendu', 'réservé'));

-- 3. Initialiser les motos existantes comme disponibles
UPDATE motos
  SET statut = 'disponible'
  WHERE statut IS NULL;

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_motos_statut
  ON motos(statut);

CREATE INDEX IF NOT EXISTS idx_motos_enterprise_statut
  ON motos(enterprise_id, statut);

CREATE INDEX IF NOT EXISTS idx_motos_date_vente
  ON motos(date_vente DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_motos_enterprise_date_vente
  ON motos(enterprise_id, date_vente DESC NULLS LAST);
