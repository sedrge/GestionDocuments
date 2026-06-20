-- ============================================
-- FIX : Activer Supabase Realtime sur les tables de chat
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- Ajouter les tables à la publication Realtime de Supabase
-- (REPLICA IDENTITY FULL seul ne suffit pas — les tables doivent aussi
--  être dans la publication pour que les événements soient diffusés)
ALTER PUBLICATION supabase_realtime ADD TABLE enterprise_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE enterprise_chats;
