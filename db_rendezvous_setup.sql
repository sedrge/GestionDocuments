-- =====================================================================
-- SenMoto — Table pour la gestion des rendez-vous (Gestion > Rendez-Vous)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.
-- =====================================================================

create table if not exists public.rendez_vous (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  date_rdv        date,                       -- Date du rendez-vous (YYYY-MM-DD)
  heure_rdv       text,                       -- Heure du rendez-vous (HH:MM)
  lieu            text,                       -- Lieu du rendez-vous
  nom_prenom      text,                       -- Nom & Prénom du client
  telephone       text,                       -- Téléphone du client
  motif           text,                       -- Motif du rendez-vous
  description     text,                       -- Détails additionnels
  statut          text not null default 'en_attente',
  -- Valeurs possibles : 'en_attente', 'reporte', 'annule', 'termine'

  -- Lien optionnel vers le registre qui a déclenché le RDV
  registre_id     uuid references public.registres(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rendez_vous_user_id_idx       on public.rendez_vous (user_id);
create index if not exists rendez_vous_date_idx          on public.rendez_vous (user_id, date_rdv);
create index if not exists rendez_vous_statut_idx        on public.rendez_vous (user_id, statut);
create index if not exists rendez_vous_registre_id_idx   on public.rendez_vous (registre_id);

alter table public.rendez_vous enable row level security;

drop policy if exists "rdv_select_own" on public.rendez_vous;
create policy "rdv_select_own" on public.rendez_vous
  for select using (auth.uid() = user_id);

drop policy if exists "rdv_insert_own" on public.rendez_vous;
create policy "rdv_insert_own" on public.rendez_vous
  for insert with check (auth.uid() = user_id);

drop policy if exists "rdv_update_own" on public.rendez_vous;
create policy "rdv_update_own" on public.rendez_vous
  for update using (auth.uid() = user_id);

drop policy if exists "rdv_delete_own" on public.rendez_vous;
create policy "rdv_delete_own" on public.rendez_vous
  for delete using (auth.uid() = user_id);
