-- ─── Colonne like_count sur les motos ────────────────────────────────────────
ALTER TABLE motos ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- ─── Colonne like_count sur les publications ──────────────────────────────────
ALTER TABLE enterprise_publications ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- ─── Fonction RPC : toggle like moto (SECURITY DEFINER pour contourner RLS) ──
CREATE OR REPLACE FUNCTION toggle_moto_like(p_moto_id UUID, p_increment BOOLEAN)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF p_increment THEN
    UPDATE motos
    SET like_count = COALESCE(like_count, 0) + 1
    WHERE id = p_moto_id
    RETURNING like_count INTO new_count;
  ELSE
    UPDATE motos
    SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
    WHERE id = p_moto_id
    RETURNING like_count INTO new_count;
  END IF;
  RETURN COALESCE(new_count, 0);
END;
$$;

-- ─── Fonction RPC : toggle like publication ───────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_pub_like(p_pub_id UUID, p_increment BOOLEAN)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF p_increment THEN
    UPDATE enterprise_publications
    SET like_count = COALESCE(like_count, 0) + 1
    WHERE id = p_pub_id
    RETURNING like_count INTO new_count;
  ELSE
    UPDATE enterprise_publications
    SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
    WHERE id = p_pub_id
    RETURNING like_count INTO new_count;
  END IF;
  RETURN COALESCE(new_count, 0);
END;
$$;

-- ─── Accès public aux fonctions (anon = utilisateurs non connectés du feed) ───
GRANT EXECUTE ON FUNCTION toggle_moto_like TO anon, authenticated;
GRANT EXECUTE ON FUNCTION toggle_pub_like  TO anon, authenticated;
