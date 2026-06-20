-- ============================================
-- FIX : Récursion RLS sur enterprise_chats / enterprise_chat_messages
-- Exécuter dans Supabase SQL Editor APRÈS db_fix_rls_recursion.sql
-- ============================================

-- 1. Fonction SECURITY DEFINER : vérifie si l'utilisateur connecté est membre
--    (admin ou user) d'une entreprise donnée, SANS déclencher le RLS
--    (évite la boucle infinie dans les politiques enterprise_chats).
CREATE OR REPLACE FUNCTION public.is_enterprise_member(eid UUID)
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
  )
  OR EXISTS (
    SELECT 1 FROM enterprise_users
     WHERE enterprise_users.user_id = auth.uid()
       AND enterprise_users.enterprise_id = eid
  );
$$;

-- 2. Remplacer la politique enterprise_chats (supprime la sous-requête récursive)
DROP POLICY IF EXISTS "enterprise_admin_chats" ON enterprise_chats;

CREATE POLICY "enterprise_admin_chats" ON enterprise_chats
  FOR ALL TO authenticated
  USING (is_enterprise_member(enterprise_id));

-- 3. Remplacer la politique enterprise_chat_messages (idem)
DROP POLICY IF EXISTS "enterprise_admin_messages" ON enterprise_chat_messages;

CREATE POLICY "enterprise_admin_messages" ON enterprise_chat_messages
  FOR ALL TO authenticated
  USING (
    chat_id IN (
      SELECT id FROM enterprise_chats
       WHERE is_enterprise_member(enterprise_id)
    )
  );

-- 4. S'assurer que les clients anonymes peuvent toujours créer des chats
--    (les politiques anon ne changent pas, mais on les recrée par sécurité)
DROP POLICY IF EXISTS "client_chat_access" ON enterprise_chats;
CREATE POLICY "client_chat_access" ON enterprise_chats
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_message_access" ON enterprise_chat_messages;
CREATE POLICY "client_message_access" ON enterprise_chat_messages
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
