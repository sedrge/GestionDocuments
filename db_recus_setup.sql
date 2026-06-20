-- =====================================================================
-- docvault — Tables pour la fonctionnalité "Réçu / Facture"
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- =====================================================================

-- 1) Paramètres de l'entreprise (entête du réçu, articles, etc.)
--    Une ligne par utilisateur (UNIQUE user_id)
create table if not exists public.entreprise_parametres (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  nom_entreprise  text not null default '',
  prefix_facture  text not null default '',          -- ex: "FC" pour Fortune Service
  sous_titre      text default '',                   -- ex: "Vente de motos et Ordinateurs"
  articles_vente  text default '',                   -- description / liste des articles
  telephone       text default '',
  adresse         text default '',
  localisation    text default '',
  logo_uri        text default '',                   -- data:image/...;base64,...
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint entreprise_parametres_user_unique unique (user_id)
);

alter table public.entreprise_parametres enable row level security;

drop policy if exists "ep_select_own" on public.entreprise_parametres;
create policy "ep_select_own" on public.entreprise_parametres
  for select using (auth.uid() = user_id);

drop policy if exists "ep_insert_own" on public.entreprise_parametres;
create policy "ep_insert_own" on public.entreprise_parametres
  for insert with check (auth.uid() = user_id);

drop policy if exists "ep_update_own" on public.entreprise_parametres;
create policy "ep_update_own" on public.entreprise_parametres
  for update using (auth.uid() = user_id);

drop policy if exists "ep_delete_own" on public.entreprise_parametres;
create policy "ep_delete_own" on public.entreprise_parametres
  for delete using (auth.uid() = user_id);


-- 2) Dossiers année_mois pour les réçus (même pattern que annees_mois_decharge)
create table if not exists public.annees_mois_recu (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nom         text not null,                         -- ex: "2026_janvier"
  created_at  timestamptz not null default now()
);

alter table public.annees_mois_recu enable row level security;

drop policy if exists "amr_select_own" on public.annees_mois_recu;
create policy "amr_select_own" on public.annees_mois_recu
  for select using (auth.uid() = user_id);

drop policy if exists "amr_insert_own" on public.annees_mois_recu;
create policy "amr_insert_own" on public.annees_mois_recu
  for insert with check (auth.uid() = user_id);

drop policy if exists "amr_update_own" on public.annees_mois_recu;
create policy "amr_update_own" on public.annees_mois_recu
  for update using (auth.uid() = user_id);

drop policy if exists "amr_delete_own" on public.annees_mois_recu;
create policy "amr_delete_own" on public.annees_mois_recu
  for delete using (auth.uid() = user_id);


-- 3) Réçus / factures
create table if not exists public.recus (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  annee_mois_id       uuid not null references public.annees_mois_recu(id) on delete cascade,

  numero_facture      text not null,                 -- ex: "FC_00001_2026"
  sequence_num        integer not null,              -- ex: 1
  year                integer not null,              -- ex: 2026

  date                date,                          -- date du réçu (Jour/Mois/Année)
  nom_client          text default '',
  adresse_client      text default '',

  article             text default '',               -- "MOTOS" sur l'image
  couleur             text default '',
  marque              text default '',
  type                text default '',
  chassis_no          text default '',
  moteur_no           text default '',

  quantite            numeric default 1,
  prix_unitaire       numeric default 0,
  prix_total          numeric default 0,
  prix_total_lettres  text default '',

  signature_vendeur   text default '',               -- data:image/...
  signature_client    text default '',               -- data:image/...

  created_at          timestamptz not null default now()
);

-- Index utile pour rechercher / générer le prochain numéro de l'année
create index if not exists recus_user_year_seq_idx
  on public.recus (user_id, year, sequence_num desc);

-- Unicité du numéro de facture par utilisateur
create unique index if not exists recus_user_numero_unique
  on public.recus (user_id, numero_facture);

alter table public.recus enable row level security;

drop policy if exists "recus_select_own" on public.recus;
create policy "recus_select_own" on public.recus
  for select using (auth.uid() = user_id);

drop policy if exists "recus_insert_own" on public.recus;
create policy "recus_insert_own" on public.recus
  for insert with check (auth.uid() = user_id);

drop policy if exists "recus_update_own" on public.recus;
create policy "recus_update_own" on public.recus
  for update using (auth.uid() = user_id);

drop policy if exists "recus_delete_own" on public.recus;
create policy "recus_delete_own" on public.recus
  for delete using (auth.uid() = user_id);
