-- ============================================
-- FIX : Récupération des users avec données auth
-- PostgREST ne peut pas joindre auth.users directement
-- => On utilise des fonctions SECURITY DEFINER
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- Fonction : users en attente d'activation pour une entreprise
CREATE OR REPLACE FUNCTION public.get_enterprise_pending_users(p_enterprise_id UUID)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  created_at  TIMESTAMPTZ,
  role        TEXT,
  email       TEXT,
  full_name   TEXT,
  phone       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Vérifie que l'appelant est bien admin de cette entreprise ou super-admin
  IF NOT (
    EXISTS (SELECT 1 FROM enterprise_admins WHERE enterprise_admins.user_id = auth.uid() AND enterprise_admins.enterprise_id = p_enterprise_id)
    OR EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT
    eu.id,
    eu.user_id,
    eu.created_at::TIMESTAMPTZ,
    eu.role::TEXT,
    au.email::TEXT,
    au.raw_user_meta_data->>'full_name'  AS full_name,
    au.raw_user_meta_data->>'phone'      AS phone
  FROM enterprise_users eu
  JOIN auth.users au ON au.id = eu.user_id
  WHERE eu.enterprise_id = p_enterprise_id
    AND eu.is_active = FALSE
  ORDER BY eu.created_at DESC;
END;
$$;

-- Fonction : users actifs d'une entreprise
CREATE OR REPLACE FUNCTION public.get_enterprise_active_users(p_enterprise_id UUID)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  created_at  TIMESTAMPTZ,
  role        TEXT,
  is_active   BOOLEAN,
  email       TEXT,
  full_name   TEXT,
  phone       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM enterprise_admins WHERE enterprise_admins.user_id = auth.uid() AND enterprise_admins.enterprise_id = p_enterprise_id)
    OR EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT
    eu.id,
    eu.user_id,
    eu.created_at::TIMESTAMPTZ,
    eu.role::TEXT,
    eu.is_active,
    au.email::TEXT,
    au.raw_user_meta_data->>'full_name'  AS full_name,
    au.raw_user_meta_data->>'phone'      AS phone
  FROM enterprise_users eu
  JOIN auth.users au ON au.id = eu.user_id
  WHERE eu.enterprise_id = p_enterprise_id
    AND eu.is_active = TRUE
  ORDER BY eu.created_at DESC;
END;
$$;
