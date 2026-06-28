-- ============================================
-- MIGRATION: NOTIFICATIONS PUSH ENTERPRISE + CHAT
-- Exécuter sur Supabase SQL Editor
-- ============================================

-- 1. RPC: Tokens push de tous les super admins
--    Appelable par tout utilisateur (même nouveau compte juste après signUp)
CREATE OR REPLACE FUNCTION get_super_admin_push_tokens()
RETURNS TABLE(expo_token TEXT, user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT upt.expo_token, upt.user_id
    FROM user_push_tokens upt
    WHERE upt.user_id IN (SELECT sa.user_id FROM super_admins sa)
    AND upt.expo_token IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_super_admin_push_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION get_super_admin_push_tokens() TO anon;

-- 2. RPC: Tokens push des admins d'une entreprise spécifique
CREATE OR REPLACE FUNCTION get_enterprise_admin_push_tokens(p_enterprise_id UUID)
RETURNS TABLE(expo_token TEXT, user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT upt.expo_token, upt.user_id
    FROM user_push_tokens upt
    WHERE upt.user_id IN (
      SELECT ea.user_id FROM enterprise_admins ea
      WHERE ea.enterprise_id = p_enterprise_id
    )
    AND upt.expo_token IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_enterprise_admin_push_tokens(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enterprise_admin_push_tokens(UUID) TO anon;

-- 3. Colonne pour le token Expo push du client (pour notifier le client quand l'admin répond)
--    Le client doit sauvegarder son token lors de l'ouverture du chat
ALTER TABLE enterprise_chats
  ADD COLUMN IF NOT EXISTS client_expo_token TEXT;

-- 4. RPC: Récupère le token Expo du client pour un chat donné
--    Utilisé par l'admin pour notifier le client d'une réponse
CREATE OR REPLACE FUNCTION get_chat_client_expo_token(p_chat_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token TEXT;
BEGIN
  SELECT client_expo_token INTO v_token
  FROM enterprise_chats
  WHERE id = p_chat_id;
  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION get_chat_client_expo_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_client_expo_token(UUID) TO anon;

-- 5. S'assurer que les super admins peuvent lire toutes les entreprises via Realtime
--    (nécessaire pour recevoir les événements INSERT en temps réel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'enterprises'
       AND policyname = 'super_admin_read_all_enterprises'
  ) THEN
    EXECUTE '
      CREATE POLICY "super_admin_read_all_enterprises" ON enterprises
        FOR SELECT TO authenticated
        USING (
          auth.uid() IN (SELECT user_id FROM super_admins)
        )
    ';
  END IF;
END $$;
