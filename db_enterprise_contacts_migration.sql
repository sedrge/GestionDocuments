-- ============================================================
-- MIGRATION : enterprise_contacts
-- Informations de contact par entreprise (WhatsApp, tél, GPS…)
-- Exécuter dans le SQL Editor de Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS enterprise_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id  UUID NOT NULL UNIQUE REFERENCES enterprises(id) ON DELETE CASCADE,
  description    TEXT,
  whatsapp       VARCHAR(30),
  phone1         VARCHAR(30),
  phone2         VARCHAR(30),
  email          VARCHAR(255),
  address        TEXT,
  localisation   VARCHAR(100),   -- format "lat,lng"  ex: "6.3654,2.4183"
  website        VARCHAR(500),
  created_at     TIMESTAMP DEFAULT now(),
  updated_at     TIMESTAMP DEFAULT now()
);

ALTER TABLE enterprise_contacts ENABLE ROW LEVEL SECURITY;

-- Les admins de l'entreprise peuvent tout faire sur leurs propres contacts
CREATE POLICY "enterprise_admin_contact_all" ON enterprise_contacts
  FOR ALL
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM enterprise_admins WHERE user_id = auth.uid()
    )
  );

-- Lecture publique (nécessaire pour le catalogue public)
CREATE POLICY "public_read_enterprise_contacts" ON enterprise_contacts
  FOR SELECT
  USING (true);
