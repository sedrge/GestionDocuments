-- =====================================================================
-- SenMoto — Tables pour la gestion des motos (Gestion > Moto / Catalogue)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.
-- =====================================================================

-- 1) Table motos
create table if not exists public.motos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  marque              text,
  modele              text,
  categorie           text,                  -- Scooter, Sport, Tricycle, Cross...
  numero_chassis      text,                  -- VIN / châssis
  numero_moteur       text,
  immatriculation     text,
  couleur             text,
  annee_fabrication   integer,
  type                text,                  -- ex: 155, 115, ...
  cylindree           text,                  -- ex: 125cc, 150cc
  prix_achat          numeric,
  prix_vente          numeric,
  etat                text,                  -- Neuve / Occasion

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists motos_user_id_idx on public.motos (user_id);
create index if not exists motos_marque_type_idx on public.motos (user_id, marque, type);

alter table public.motos enable row level security;

drop policy if exists "motos_select_own" on public.motos;
create policy "motos_select_own" on public.motos
  for select using (auth.uid() = user_id);

drop policy if exists "motos_insert_own" on public.motos;
create policy "motos_insert_own" on public.motos
  for insert with check (auth.uid() = user_id);

drop policy if exists "motos_update_own" on public.motos;
create policy "motos_update_own" on public.motos
  for update using (auth.uid() = user_id);

drop policy if exists "motos_delete_own" on public.motos;
create policy "motos_delete_own" on public.motos
  for delete using (auth.uid() = user_id);


-- 2) Table moto_images (plusieurs images par moto, une principale)
create table if not exists public.moto_images (
  id            uuid primary key default gen_random_uuid(),
  moto_id       uuid not null references public.motos(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  image_uri     text not null,              -- data:image/...;base64,...
  is_principal  boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists moto_images_moto_idx
  on public.moto_images (moto_id, position);

alter table public.moto_images enable row level security;

drop policy if exists "mi_select_own" on public.moto_images;
create policy "mi_select_own" on public.moto_images
  for select using (auth.uid() = user_id);

drop policy if exists "mi_insert_own" on public.moto_images;
create policy "mi_insert_own" on public.moto_images
  for insert with check (auth.uid() = user_id);

drop policy if exists "mi_update_own" on public.moto_images;
create policy "mi_update_own" on public.moto_images
  for update using (auth.uid() = user_id);

drop policy if exists "mi_delete_own" on public.moto_images;
create policy "mi_delete_own" on public.moto_images
  for delete using (auth.uid() = user_id);


-- 3) Nouveaux champs sur la table decharges
alter table public.decharges add column if not exists telephone_vendeur   text;
alter table public.decharges add column if not exists telephone_acheteur  text;
alter table public.decharges add column if not exists numero_chassis      text;
alter table public.decharges add column if not exists immatriculation     text;
