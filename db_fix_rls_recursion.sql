-- ============================================
-- FIX : Récursions infinies dans les politiques RLS
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- ── FIX 1 : enterprises (user_enterprises se requêtait elle-même) ────────────

DROP POLICY IF EXISTS "user_enterprises" ON enterprises;

-- Utilise enterprises.created_by directement (référence de colonne, pas de sous-requête récursive)
CREATE POLICY "user_enterprises" ON enterprises
  FOR SELECT USING (
    auth.uid() = enterprises.created_by
    OR EXISTS (
      SELECT 1 FROM enterprise_users
      WHERE enterprise_users.enterprise_id = enterprises.id
        AND enterprise_users.user_id = auth.uid()
    )
  );

-- ── FIX 2 : enterprise_admins (admin_own_admins se requêtait elle-même) ──────

-- 1. Fonction SECURITY DEFINER pour vérifier si l'utilisateur est admin
--    d'une entreprise SANS déclencher le RLS (contourne la récursion)
CREATE OR REPLACE FUNCTION public.is_enterprise_admin(eid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enterprise_admins
    WHERE enterprise_admins.user_id = auth.uid()
      AND enterprise_admins.enterprise_id = eid
  );
$$;

-- 2. Supprimer la politique récursive
DROP POLICY IF EXISTS "admin_own_admins" ON enterprise_admins;

-- 3. Recréer la politique en utilisant la fonction (sans récursion)
CREATE POLICY "admin_own_admins" ON enterprise_admins
  FOR SELECT USING (
    is_enterprise_admin(enterprise_admins.enterprise_id)
    OR EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

-- 4. Corriger aussi les politiques UPDATE/DELETE pour enterprise_admins
--    (au cas où elles existent et causent le même problème)
DROP POLICY IF EXISTS "admin_update_admins" ON enterprise_admins;
DROP POLICY IF EXISTS "admin_delete_admins" ON enterprise_admins;

-- 5. Ajouter une politique INSERT pour les super-admins sur enterprises
--    (nécessaire si le super-admin reste connecté pendant la création)
DROP POLICY IF EXISTS "super_admin_insert_enterprise" ON enterprises;

CREATE POLICY "super_admin_insert_enterprise" ON enterprises
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
    OR auth.uid() = created_by
  );

-- 6. Politiques INSERT pour enterprise_admins
DROP POLICY IF EXISTS "super_admin_insert_admin" ON enterprise_admins;
DROP POLICY IF EXISTS "enterprise_creator_insert_admin" ON enterprise_admins;

-- Le créateur de l'entreprise peut ajouter ses admins
CREATE POLICY "enterprise_creator_insert_admin" ON enterprise_admins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM enterprises
      WHERE enterprises.id = enterprise_admins.enterprise_id
        AND enterprises.created_by = auth.uid()
    )
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );
