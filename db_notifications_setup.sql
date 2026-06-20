-- =====================================================================
-- docvault — Table pour la gestion des notifications
-- (Notifications de modification + rappels J-3, J-2, Jour-J pour les RDV)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.
-- =====================================================================

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Type de notification :
  -- 'rdv_modification' : un rendez-vous a été modifié
  -- 'rdv_rappel_j3'    : rappel 3 jours avant le RDV
  -- 'rdv_rappel_j2'    : rappel 2 jours avant le RDV
  -- 'rdv_rappel_j0'    : rappel le jour-même
  type            text not null,

  titre           text not null,            -- Titre court de la notification
  message         text not null,            -- Corps de la notification

  -- Cible : pour l'instant uniquement les rendez-vous
  rendezvous_id   uuid references public.rendez_vous(id) on delete cascade,

  -- Données contextuelles (motif, heure, nom_prenom, etc.) — JSON libre
  data            jsonb,

  -- État de lecture
  lu              boolean not null default false,

  -- Programmation : utile pour les rappels planifiés
  -- 'pending' = programmée et non encore envoyée
  -- 'sent'    = envoyée
  -- 'cancelled' = annulée (ex: RDV supprimé ou date changée)
  statut          text not null default 'sent',

  -- Pour les rappels planifiés : moment où la notif doit être envoyée
  scheduled_at    timestamptz,
  -- ID renvoyé par expo-notifications pour pouvoir annuler le push
  push_id         text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists notifications_user_id_idx       on public.notifications (user_id);
create index if not exists notifications_lu_idx            on public.notifications (user_id, lu);
create index if not exists notifications_rdv_id_idx        on public.notifications (rendezvous_id);
create index if not exists notifications_scheduled_idx     on public.notifications (user_id, statut, scheduled_at);

alter table public.notifications enable row level security;

drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notif_insert_own" on public.notifications;
create policy "notif_insert_own" on public.notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own" on public.notifications
  for update using (auth.uid() = user_id);

drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);
