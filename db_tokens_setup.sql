-- Table pour stocker les tokens de notification push
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index pour recherche rapide par user_id
CREATE INDEX idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_push_tokens_updated_at ON user_push_tokens;
CREATE TRIGGER trigger_update_user_push_tokens_updated_at
BEFORE UPDATE ON user_push_tokens
FOR EACH ROW
EXECUTE FUNCTION update_user_push_tokens_updated_at();

-- RLS Policies
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_tokens" ON user_push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_tokens" ON user_push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_tokens" ON user_push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_tokens" ON user_push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);
