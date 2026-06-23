-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION : Audit Logs + Permissions Menu Utilisateur
-- À exécuter dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. TABLE : audit_logs ──────────────────────────────────────────────────
-- Enregistre chaque action réalisée par un utilisateur dans son entreprise.

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  user_name     TEXT,                             -- Nom affiché au moment de l'action
  action        TEXT        NOT NULL,             -- CREATE | UPDATE | DELETE | UPLOAD | LOGIN | LOGOUT | APPROVE | DEACTIVATE
  entity_type   TEXT        NOT NULL,             -- document | categorie | moto | vente | rendezvous | registre | decharge | recu | user | session
  entity_id     TEXT,                             -- ID de l'entité concernée
  entity_name   TEXT,                             -- Nom lisible de l'entité
  details       JSONB,                            -- Données complémentaires libres
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_enterprise
  ON audit_logs(enterprise_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON audit_logs(user_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Les admins d'entreprise lisent tous les logs de leur entreprise
CREATE POLICY "admin_read_audit_logs"
  ON audit_logs FOR SELECT
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Tout membre actif peut insérer ses propres logs
CREATE POLICY "members_insert_audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
      UNION
      SELECT enterprise_id FROM enterprise_users  WHERE user_id = auth.uid() AND is_active = true
    )
  );


-- ─── 2. TABLE : user_menu_permissions ───────────────────────────────────────
-- Contrôle quels éléments du menu un utilisateur peut voir.
-- Si un user n'a aucune ligne → il voit tout (comportement par défaut).
-- Si au moins une ligne existe → seuls les items avec is_enabled=true sont visibles.

CREATE TABLE IF NOT EXISTS user_menu_permissions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  menu_key      TEXT        NOT NULL,
  -- Clés disponibles :
  --   fichier.nouveau_dossier | fichier.importer_fichier | fichier.prendre_photo
  --   fichier.filmer_video    | fichier.registre         | fichier.decharge
  --   gestion.moto            | gestion.catalogue        | gestion.vente
  --   gestion.recu            | gestion.rendez_vous
  --   parametres.logo         | parametres.entete        | parametres.pin
  --   affichage.list          | affichage.details        | affichage.grid
  is_enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enterprise_id, user_id, menu_key)
);

CREATE INDEX IF NOT EXISTS idx_user_menu_perms
  ON user_menu_permissions(enterprise_id, user_id);

ALTER TABLE user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Les admins gèrent les permissions de leur entreprise
CREATE POLICY "admin_manage_menu_permissions"
  ON user_menu_permissions FOR ALL
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Chaque user lit ses propres permissions
CREATE POLICY "user_read_own_permissions"
  ON user_menu_permissions FOR SELECT
  USING (user_id = auth.uid());
