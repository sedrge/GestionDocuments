-- ============================================
-- MIGRATION CHAT : ATTRIBUTION + PUSH TOKENS
-- Exécuter sur Supabase SQL Editor
-- ============================================

-- 1. Colonne assigned_to : l'agent entreprise qui a répondu en premier
ALTER TABLE enterprise_chats
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chats_assigned ON enterprise_chats(assigned_to);

-- 2. Fonction (SECURITY DEFINER) : récupère les tokens push pour un chat donné.
--    - Si le chat est déjà attribué → token du seul agent assigné.
--    - Sinon → tokens de TOUS les membres actifs de l'entreprise.
--    Appelable par les clients anonymes.
CREATE OR REPLACE FUNCTION get_chat_push_tokens(p_chat_id UUID)
RETURNS TABLE(expo_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_to  UUID;
  v_enterprise_id UUID;
BEGIN
  SELECT assigned_to, enterprise_id
    INTO v_assigned_to, v_enterprise_id
    FROM enterprise_chats
   WHERE id = p_chat_id;

  IF v_assigned_to IS NOT NULL THEN
    -- Notifier uniquement l'agent assigné
    RETURN QUERY
      SELECT upt.expo_token
        FROM user_push_tokens upt
       WHERE upt.user_id = v_assigned_to
         AND upt.expo_token IS NOT NULL;
  ELSE
    -- Notifier tous les membres actifs de l'entreprise
    RETURN QUERY
      SELECT upt.expo_token
        FROM user_push_tokens upt
       WHERE upt.user_id IN (
           SELECT user_id FROM enterprise_admins  WHERE enterprise_id = v_enterprise_id
           UNION
           SELECT user_id FROM enterprise_users   WHERE enterprise_id = v_enterprise_id AND is_active = true
         )
         AND upt.expo_token IS NOT NULL;
  END IF;
END;
$$;

-- Autoriser les clients anonymes à appeler cette fonction
GRANT EXECUTE ON FUNCTION get_chat_push_tokens(UUID) TO anon;

-- 3. Politique lecture publique sur enterprises (pour afficher le logo côté client)
--    (Ignorer l'erreur si elle existe déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'enterprises'
       AND policyname = 'public_read_enterprises'
  ) THEN
    EXECUTE '
      CREATE POLICY "public_read_enterprises" ON enterprises
        FOR SELECT TO anon
        USING (is_active = true)
    ';
  END IF;
END $$;
