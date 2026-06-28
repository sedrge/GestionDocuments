-- ================================================================
-- Migration : Configuration du secret d'accès Super Admin
-- ================================================================
-- À exécuter dans Supabase SQL Editor

-- 1. Table de configuration
CREATE TABLE IF NOT EXISTS super_admin_config (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  secret_type   TEXT        NOT NULL DEFAULT 'taps' CHECK (secret_type IN ('taps', 'phrase')),
  tap_count     INTEGER     DEFAULT 11,
  secret_phrase TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activer RLS
ALTER TABLE super_admin_config ENABLE ROW LEVEL SECURITY;

-- 3. Lecture publique (l'app lit la config sans être connectée)
CREATE POLICY "public_read_config" ON super_admin_config
  FOR SELECT
  USING (true);

-- 4. Seuls les super admins peuvent écrire
CREATE POLICY "super_admin_write_config" ON super_admin_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- 5. Ajouter les colonnes name et email à super_admins si elles n'existent pas
ALTER TABLE super_admins
  ADD COLUMN IF NOT EXISTS name  TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;
