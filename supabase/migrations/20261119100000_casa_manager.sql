-- Casa-Manager: Assistent im Chat (Edge Function „manager“, Claude API).
-- Schreibt nur nach Bestätigung, mit dem Login des Fragenden (RLS gilt). Jede Änderung landet in manager_log (vorher/nachher),
-- damit „Rückgängig“ geht. Kosten-Bremse: höchstens 200 Aufrufe pro Tag und Haushalt.

-- Aufgaben archivieren statt löschen
alter table public.tasks add column if not exists archived_at timestamptz;

-- Protokoll aller ausgeführten Änderungen
create table public.manager_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  batch_id     uuid not null,                       -- eine Änderungsrunde (ein „Okay“)
  position     smallint not null default 0,
  table_name   text not null,
  row_id       uuid,
  op           text not null check (op in ('insert', 'update', 'delete')),
  before       jsonb,
  after        jsonb,
  summary      text not null,
  undone_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index manager_log_batch_idx on public.manager_log (household_id, created_at desc);
alter table public.manager_log enable row level security;
grant select, insert, update on public.manager_log to authenticated;
grant all on public.manager_log to service_role;
create policy "manager_log: haushalt lesen" on public.manager_log for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "manager_log: eigene schreiben" on public.manager_log for insert to authenticated
  with check (member_id = public.my_member_id() and household_id in (select public.my_household_ids()));
create policy "manager_log: eigene rückgängig" on public.manager_log for update to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

-- Zähler: Claude-Aufrufe pro Tag (nur über manager_take_call() änderbar)
create table public.manager_usage (
  household_id uuid not null references public.households(id) on delete cascade,
  day          date not null,
  calls        integer not null default 0,
  primary key (household_id, day)
);
alter table public.manager_usage enable row level security;
grant all on public.manager_usage to service_role;

create or replace function public.manager_take_call(p_limit integer default 200)
returns boolean language plpgsql security definer set search_path = public as $$
declare hid uuid; d date := (now() at time zone 'Europe/Berlin')::date; n integer;
begin
  select household_id into hid from public.members where id = public.my_member_id();
  if hid is null then return false; end if;
  insert into public.manager_usage (household_id, day, calls) values (hid, d, 1)
  on conflict (household_id, day) do update set calls = public.manager_usage.calls + 1
  returning calls into n;
  return n <= p_limit;
end $$;
revoke all on function public.manager_take_call(integer) from public;
grant execute on function public.manager_take_call(integer) to authenticated;
