-- ============================================================
-- CORRECTIF : les vues *_public (enterprise_facebook_pages_public,
-- enterprise_social_connections_public) sont en security_invoker = true,
-- ce qui exécute la requête avec les droits de l'appelant. Or le
-- REVOKE SELECT ... FROM authenticated sur les tables de base bloque
-- aussi l'accès via la vue (permission denied 42501), pas seulement
-- le select('*') direct qu'on voulait empêcher.
--
-- Fix : accorder un GRANT SELECT limité aux colonnes "sûres" (sans les
-- tokens) directement sur les tables de base. Un select('*') ou toute
-- tentative de lire les colonnes de token reste bloquée (Postgres refuse
-- toute la requête si une seule colonne demandée n'est pas autorisée).
--
-- Additif et idempotent : n'affecte pas les données existantes.
-- Exécuter dans le SQL Editor de Supabase.
-- ============================================================

GRANT SELECT (
  id, enterprise_id, fb_page_id, fb_page_name,
  connected_by_user_id, connected_at, updated_at
) ON enterprise_facebook_pages TO authenticated;

GRANT SELECT (
  id, enterprise_id, platform, external_account_name,
  connected_by_user_id, connected_at, updated_at
) ON enterprise_social_connections TO authenticated;
