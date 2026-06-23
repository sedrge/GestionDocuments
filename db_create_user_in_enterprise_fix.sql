-- ============================================================
-- FIX : Création d'utilisateur par un admin d'entreprise
-- Problème : la politique RLS "user_self_join" bloque l'INSERT
--            quand auth.uid() != user_id (cas admin créant un user)
-- Solution : fonction SECURITY DEFINER qui contourne le RLS
--            après avoir vérifié que l'appelant est bien admin
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Politique INSERT manquante pour les admins d'entreprise
--    (permet aussi à un admin d'ajouter un user existant)
DROP POLICY IF EXISTS "admin_insert_users" ON enterprise_users;

CREATE POLICY "admin_insert_users" ON enterprise_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM enterprise_admins
      WHERE enterprise_admins.user_id = auth.uid()
        AND enterprise_admins.enterprise_id = enterprise_users.enterprise_id
    )
    OR EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

-- 2. Fonction SECURITY DEFINER pour qu'un admin puisse insérer
--    un utilisateur dans son entreprise sans conflit de session RLS
CREATE OR REPLACE FUNCTION public.add_user_to_enterprise(
  p_enterprise_id UUID,
  p_user_id       UUID,
  p_role          TEXT DEFAULT 'user',
  p_is_active     BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifie que l'appelant est admin de cette entreprise ou super-admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM enterprise_admins
      WHERE enterprise_admins.user_id = auth.uid()
        AND enterprise_admins.enterprise_id = p_enterprise_id
    )
    OR EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas admin de cette entreprise';
  END IF;

  INSERT INTO enterprise_users (enterprise_id, user_id, role, is_active)
  VALUES (p_enterprise_id, p_user_id, p_role, p_is_active)
  ON CONFLICT (enterprise_id, user_id)
  DO UPDATE SET
    role      = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = now();
END;
$$;
