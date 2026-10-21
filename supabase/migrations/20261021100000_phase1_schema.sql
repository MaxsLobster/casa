-- Casa · Phase 1 · Schema
-- Alles hängt an einem Haushalt. Mitglieder sind Max und Anna, später evtl. mehr.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid unique references auth.users(id) on delete set null,
  email        text not null,
  display_name text not null,
  role         text not null default 'partner',   -- partner | family (später)
  created_at   timestamptz not null default now()
);
create unique index members_email_idx on public.members (lower(email));

create type public.task_status as enum ('offen', 'zugesagt', 'geparkt', 'erledigt');

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  title           text not null check (length(trim(title)) > 0),
  owner_member_id uuid not null references public.members(id),
  due_date        date not null,
  status          public.task_status not null default 'offen',
  note            text,
  created_by      uuid references public.members(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  done_at         timestamptz
);
create index tasks_household_due_idx on public.tasks (household_id, due_date);

-- member_id NULL bedeutet "beide" (bzw. später: alle im Haushalt)
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  date         date not null,
  start_time   time,
  end_time     time,
  member_id    uuid references public.members(id),
  note         text,
  created_by   uuid references public.members(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index events_household_date_idx on public.events (household_id, date);

-- Normalwoche: weekday 1 = Montag … 7 = Sonntag
-- slots: valerie_bringen, valerie_holen, anna_arbeit, nachmittag, abend_essen, abend_bett, wochenende
create table public.normal_week (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  slot         text not null,
  value        text,
  at           time,
  is_open      boolean not null default false,
  note         text,
  updated_at   timestamptz not null default now(),
  unique (household_id, weekday, slot)
);

-- Abweichung von der Normalwoche an einem konkreten Datum
create table public.week_overrides (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  slot         text not null,
  value        text,
  at           time,
  note         text,
  created_by   uuid references public.members(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, date, slot)
);

-- Einstellungen pro Mitglied (Ruhezeiten werden ab Phase 3 genutzt)
create table public.settings (
  member_id         uuid primary key references public.members(id) on delete cascade,
  dark_mode_auto    boolean not null default true,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end   time not null default '07:00',
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tasks_touch          before update on public.tasks          for each row execute function public.touch_updated_at();
create trigger events_touch         before update on public.events         for each row execute function public.touch_updated_at();
create trigger normal_week_touch    before update on public.normal_week    for each row execute function public.touch_updated_at();
create trigger week_overrides_touch before update on public.week_overrides for each row execute function public.touch_updated_at();
create trigger settings_touch       before update on public.settings       for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Login nur für freigeschaltete Adressen
-- Beim ersten Login legt Supabase einen auth.users-Eintrag an. Gibt es dazu
-- kein Mitglied mit dieser E-Mail, wird der Login abgelehnt.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m_id uuid;
begin
  select id into m_id
  from public.members
  where lower(email) = lower(new.email) and user_id is null
  limit 1;

  if m_id is null then
    raise exception 'Diese E-Mail-Adresse ist für Casa nicht freigeschaltet.';
  end if;

  update public.members set user_id = new.id where id = m_id;
  insert into public.settings (member_id) values (m_id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  before insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: nur Mitglieder des Haushalts sehen die Daten
-- ---------------------------------------------------------------------------

create or replace function public.my_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.members where user_id = auth.uid();
$$;

create or replace function public.my_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where user_id = auth.uid() limit 1;
$$;

alter table public.households    enable row level security;
alter table public.members       enable row level security;
alter table public.tasks         enable row level security;
alter table public.events        enable row level security;
alter table public.normal_week   enable row level security;
alter table public.week_overrides enable row level security;
alter table public.settings      enable row level security;

create policy "households: eigene lesen" on public.households
  for select to authenticated using (id in (select public.my_household_ids()));

create policy "members: eigener haushalt lesen" on public.members
  for select to authenticated using (household_id in (select public.my_household_ids()));
create policy "members: eigenen namen ändern" on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tasks: haushalt" on public.tasks
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "events: haushalt" on public.events
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "normal_week: haushalt" on public.normal_week
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "week_overrides: haushalt" on public.week_overrides
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "settings: eigene" on public.settings
  for all to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

-- ---------------------------------------------------------------------------
-- Rechte für die API-Rollen
-- Im Projekt ist "Automatically expose new tables" aus, darum ausdrücklich.
-- Nur eingeloggte Nutzer (authenticated) dürfen auf die Tabellen; anon bekommt nichts.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage on type public.task_status to authenticated, service_role;

revoke all on function public.my_household_ids() from public;
revoke all on function public.my_member_id() from public;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.touch_updated_at() from public;
grant execute on function public.my_household_ids() to authenticated, service_role;
grant execute on function public.my_member_id() to authenticated, service_role;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Realtime: Änderungen sofort beim anderen sichtbar
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.tasks, public.events, public.normal_week, public.week_overrides, public.settings, public.members;

-- Für später (nur vorgesehen, nicht gebaut):
--   requests (Phase 2), push_subscriptions (Phase 3), ideas (Phase 4), contracts (Phase 5)
