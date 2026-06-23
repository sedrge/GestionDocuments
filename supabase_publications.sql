-- ─── Table des publications d'entreprise ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_publications (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  enterprise_id uuid        NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  texte         text,
  images        text[]      NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_enterprise
  ON enterprise_publications(enterprise_id);

CREATE INDEX IF NOT EXISTS idx_pub_created
  ON enterprise_publications(created_at DESC);

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE enterprise_publications ENABLE ROW LEVEL SECURITY;

-- Lecture publique (feed visible par tous)
CREATE POLICY "pub_select_public"
  ON enterprise_publications FOR SELECT
  USING (true);

-- L'admin de l'entreprise peut tout faire
CREATE POLICY "pub_all_admin"
  ON enterprise_publications FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM enterprise_admins
      WHERE enterprise_id = enterprise_publications.enterprise_id
        AND role = 'enterprise_admin'
    )
  );

-- ─── Bucket de stockage pour les images ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('publication_images', 'publication_images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "pub_img_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'publication_images');

CREATE POLICY "pub_img_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'publication_images' AND auth.role() = 'authenticated');

CREATE POLICY "pub_img_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'publication_images' AND auth.role() = 'authenticated');
