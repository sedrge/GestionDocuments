-- =====================================================================
-- Migration : Feed public + enterprise_id sur motos
-- À exécuter dans l'éditeur SQL de Supabase
-- =====================================================================

-- 1. Ajouter enterprise_id à la table motos (s'il n'existe pas déjà)
ALTER TABLE public.motos
  ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS motos_enterprise_idx ON public.motos (enterprise_id);

-- 2. Politique lecture publique sur public.motos
DROP POLICY IF EXISTS "public_read_motos" ON public.motos;
CREATE POLICY "public_read_motos" ON public.motos
  FOR SELECT TO anon USING (true);

-- 3. Politique lecture publique sur public.moto_images
DROP POLICY IF EXISTS "public_read_moto_images" ON public.moto_images;
CREATE POLICY "public_read_moto_images" ON public.moto_images
  FOR SELECT TO anon USING (true);

-- 4. Politique lecture publique sur public.enterprises
DROP POLICY IF EXISTS "public_read_enterprises" ON public.enterprises;
CREATE POLICY "public_read_enterprises" ON public.enterprises
  FOR SELECT TO anon USING (true);
