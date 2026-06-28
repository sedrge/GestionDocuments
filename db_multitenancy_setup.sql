-- =====================================================================
-- SenMoto — Migration multi-tenant
-- Ajoute les entités entreprises, gestion des membres et invitations
-- =====================================================================

create table if not exists public.entreprises (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  created_by   uuid not null references auth.users(id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.entreprise_users (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  email          text not null,
  role           text not null default 'user' check (role in ('super_admin','admin','user')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint entreprise_users_unique unique (entreprise_id, user_id)
);

create table if not exists public.invitations (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  email          text not null,
  token          text not null unique,
  role           text not null default 'user' check (role in ('admin','user')),
  invited_by     uuid not null references auth.users(id) on delete set null,
  accepted_at    timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Ajout du champ entreprise_id aux tables existantes utilisées par l'application
alter table if exists public.entreprise_parametres add column if not exists entreprise_id uuid references public.entreprises(id);
alter table if exists public.annees_mois_recu add column if not exists entreprise_id uuid references public.entreprises(id);
alter table if exists public.recus add column if not exists entreprise_id uuid references public.entreprises(id);
alter table if exists public.motos add column if not exists entreprise_id uuid references public.entreprises(id);
alter table if exists public.moto_images add column if not exists entreprise_id uuid references public.entreprises(id);
alter table if exists public.rendez_vous add column if not exists entreprise_id uuid references public.entreprises(id);
alter table if exists public.notifications add column if not exists entreprise_id uuid references public.entreprises(id);

create index if not exists entreprises_created_by_idx on public.entreprises (created_by);
create index if not exists entreprise_users_entreprise_id_idx on public.entreprise_users (entreprise_id);
create index if not exists entreprise_users_user_id_idx on public.entreprise_users (user_id);
create index if not exists invitations_entreprise_id_idx on public.invitations (entreprise_id);
create index if not exists invitations_email_idx on public.invitations (email);

-- Migration partielle pour préserver les données existantes si entreprise_parametres existe
insert into public.entreprises (id, nom, created_by, is_active, created_at, updated_at)
select user_id, nom_entreprise, user_id, true, created_at, updated_at
from public.entreprise_parametres
where user_id is not null
on conflict (id) do nothing;

update public.entreprise_parametres
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

update public.annees_mois_recu
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

update public.recus
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

update public.motos
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

update public.moto_images
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

update public.rendez_vous
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

update public.notifications
set entreprise_id = user_id
where entreprise_id is null and user_id is not null;

insert into public.entreprise_users (entreprise_id, user_id, email, role, is_active)
select user_id, user_id, auth.users.email, 'admin', true
from public.entreprise_parametres
left join auth.users on auth.users.id = public.entreprise_parametres.user_id
where public.entreprise_parametres.user_id is not null
on conflict do nothing;
