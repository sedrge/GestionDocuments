-- ============================================
-- MIGRATION CHAT EN TEMPS RÉEL
-- Exécuter sur Supabase SQL Editor
-- ============================================

-- 1. TABLE: ENTERPRISE_CHATS (conversations)
CREATE TABLE IF NOT EXISTS enterprise_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_admin INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLE: ENTERPRISE_CHAT_MESSAGES (messages)
CREATE TABLE IF NOT EXISTS enterprise_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES enterprise_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin')),
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. INDEX pour les performances
CREATE INDEX IF NOT EXISTS idx_chats_enterprise ON enterprise_chats(enterprise_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON enterprise_chat_messages(chat_id, created_at);

-- 4. ACTIVER REALTIME sur les tables
ALTER TABLE enterprise_chats REPLICA IDENTITY FULL;
ALTER TABLE enterprise_chat_messages REPLICA IDENTITY FULL;

-- 5. RLS (Row Level Security)
ALTER TABLE enterprise_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_chat_messages ENABLE ROW LEVEL SECURITY;

-- Les admins d'entreprise peuvent voir les chats de leur entreprise
CREATE POLICY "enterprise_admin_chats" ON enterprise_chats
  FOR ALL TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
      UNION
      SELECT enterprise_id FROM enterprise_users WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent voir les messages des chats de leur entreprise
CREATE POLICY "enterprise_admin_messages" ON enterprise_chat_messages
  FOR ALL TO authenticated
  USING (
    chat_id IN (
      SELECT id FROM enterprise_chats
      WHERE enterprise_id IN (
        SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
        UNION
        SELECT enterprise_id FROM enterprise_users WHERE user_id = auth.uid()
      )
    )
  );

-- Accès anonyme pour les clients (via token)
CREATE POLICY "client_chat_access" ON enterprise_chats
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "client_message_access" ON enterprise_chat_messages
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
