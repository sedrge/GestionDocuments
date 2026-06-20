-- ============================================
-- MIGRATION : EMAIL ENTREPRISE + RLS COMPATIBILITÉ
-- À exécuter APRÈS db_multitenant_migration.sql
-- Supabase SQL Editor
-- ============================================

-- 1. Ajouter la colonne email à la table enterprises
ALTER TABLE enterprises
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. RLS corrigé pour categories (compatibilité avec les anciennes données sans enterprise_id)
DROP POLICY IF EXISTS "user_categories" ON categories;

CREATE POLICY "user_categories" ON categories
  FOR SELECT USING (
    -- Nouvelles données multi-tenant : visible si membre actif de l'entreprise
    EXISTS (
      SELECT 1 FROM enterprise_users
      WHERE enterprise_users.user_id = auth.uid()
        AND enterprise_users.enterprise_id = categories.enterprise_id
        AND enterprise_users.is_active = TRUE
    )
    OR
    -- Admin d'entreprise
    EXISTS (
      SELECT 1 FROM enterprise_admins
      WHERE enterprise_admins.user_id = auth.uid()
        AND enterprise_admins.enterprise_id = categories.enterprise_id
    )
    OR
    -- Données héritées sans enterprise_id : visible uniquement par le propriétaire original
    (categories.enterprise_id IS NULL AND categories.user_id = auth.uid())
  );

-- 3. RLS corrigé pour documents (même logique)
DROP POLICY IF EXISTS "user_docs" ON documents;

CREATE POLICY "user_docs" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enterprise_users
      WHERE enterprise_users.user_id = auth.uid()
        AND enterprise_users.enterprise_id = documents.enterprise_id
        AND enterprise_users.is_active = TRUE
    )
    OR
    EXISTS (
      SELECT 1 FROM enterprise_admins
      WHERE enterprise_admins.user_id = auth.uid()
        AND enterprise_admins.enterprise_id = documents.enterprise_id
    )
    OR
    (documents.enterprise_id IS NULL AND documents.user_id = auth.uid())
  );

-- 4. Politiques INSERT pour categories (l'utilisateur peut créer dans son entreprise)
DROP POLICY IF EXISTS "user_insert_categories" ON categories;

CREATE POLICY "user_insert_categories" ON categories
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM enterprise_users
        WHERE enterprise_users.user_id = auth.uid()
          AND enterprise_users.enterprise_id = categories.enterprise_id
          AND enterprise_users.is_active = TRUE
      )
      OR
      EXISTS (
        SELECT 1 FROM enterprise_admins
        WHERE enterprise_admins.user_id = auth.uid()
          AND enterprise_admins.enterprise_id = categories.enterprise_id
      )
    )
    OR categories.enterprise_id IS NULL
  );

-- 5. Politiques INSERT pour documents
DROP POLICY IF EXISTS "user_insert_docs" ON documents;

CREATE POLICY "user_insert_docs" ON documents
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM enterprise_users
        WHERE enterprise_users.user_id = auth.uid()
          AND enterprise_users.enterprise_id = documents.enterprise_id
          AND enterprise_users.is_active = TRUE
      )
      OR
      EXISTS (
        SELECT 1 FROM enterprise_admins
        WHERE enterprise_admins.user_id = auth.uid()
          AND enterprise_admins.enterprise_id = documents.enterprise_id
      )
    )
    OR documents.enterprise_id IS NULL
  );

-- 6. Politiques INSERT pour enterprise_users (pour joinEnterprise)
DROP POLICY IF EXISTS "user_self_join" ON enterprise_users;

CREATE POLICY "user_self_join" ON enterprise_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Politiques UPDATE pour enterprise_users (admin peut activer/désactiver)
DROP POLICY IF EXISTS "admin_update_users" ON enterprise_users;

CREATE POLICY "admin_update_users" ON enterprise_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM enterprise_admins
      WHERE enterprise_admins.user_id = auth.uid()
        AND enterprise_admins.enterprise_id = enterprise_users.enterprise_id
    )
    OR
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

-- 8. Politiques INSERT pour enterprises (création d'entreprise)
DROP POLICY IF EXISTS "user_create_enterprise" ON enterprises;

CREATE POLICY "user_create_enterprise" ON enterprises
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 9. Politiques UPDATE pour enterprises (super-admin uniquement)
DROP POLICY IF EXISTS "super_admin_update_enterprise" ON enterprises;

CREATE POLICY "super_admin_update_enterprise" ON enterprises
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

-- 10. Politiques INSERT pour enterprise_admins
DROP POLICY IF EXISTS "admin_insert_self" ON enterprise_admins;

CREATE POLICY "admin_insert_self" ON enterprise_admins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- INSERTION SUPER-ADMIN
-- Remplacez 'VOTRE_USER_ID' par votre UUID Supabase
-- (visible dans Authentication > Users)
-- ============================================
-- INSERT INTO super_admins (user_id) VALUES ('VOTRE_USER_ID');

-- ============================================
-- INDEX SUPPLÉMENTAIRE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_enterprises_email ON enterprises(email);
