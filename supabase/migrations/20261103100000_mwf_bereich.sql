-- v9: Bereich Munich Watch Fair (MWF)
--  · tasks/anchors: area (casa | mwf), bestehendes = casa
--  · tasks: fair_id (Runde), template_id (aus welcher Vorlagenzeile), is_running (laufend), is_yearly (Jahr)
--  · settings: workday_on (Arbeitstag an diesem Datum), mwf_notify (aus | briefing | sofort)
--  · fairs: Messetermine · checklist_template: Vorlage der Runde · ideas: Ideen-Parkplatz
--  · Runde: Aufgaben aus der Vorlage automatisch erzeugen (Funktion + täglicher Cron)
--  · Push und Briefing lassen Bereich mwf aus, solange mwf_notify = aus
-- Keine Aussteller-Daten: nur Termine und eigene Aufgaben.

-- ---------------------------------------------------------------------------
-- Neue Tabellen
-- ---------------------------------------------------------------------------

create table public.fairs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  note         text,
  created_at   timestamptz not null default now(),
  unique (household_id, date)
);

create table public.checklist_template (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  area            text not null default 'mwf' check (area in ('casa', 'mwf')),
  title           text not null check (length(trim(title)) > 0),
  owner_member_id uuid references public.members(id) on delete set null,   -- leer = beide
  -- Abschnitt der Zeitleiste
  section         text not null default 'before' check (section in ('start', 'until', 'before', 'eve', 'fair')),
  -- Tage vor der Messe; leer = Freitag der Startwoche
  days_before     smallint,
  is_running      boolean not null default false,
  sort            smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index checklist_template_household_idx on public.checklist_template (household_id, area);

create table public.ideas (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  area         text not null default 'mwf' check (area in ('casa', 'mwf')),
  text         text not null check (length(trim(text)) > 0),
  created_by   uuid references public.members(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index ideas_household_idx on public.ideas (household_id, area);

create trigger checklist_template_touch before update on public.checklist_template for each row execute function public.touch_updated_at();
create trigger ideas_touch before update on public.ideas for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Bestehende Tabellen
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column area        text not null default 'casa' check (area in ('casa', 'mwf')),
  add column fair_id     uuid references public.fairs(id) on delete cascade,
  add column template_id uuid references public.checklist_template(id) on delete set null,
  add column is_running  boolean not null default false,
  add column is_yearly   boolean not null default false;
create index tasks_area_idx on public.tasks (household_id, area);
create index tasks_fair_idx on public.tasks (fair_id) where fair_id is not null;
-- Pro Vorlagenzeile und Messe höchstens eine Aufgabe
create unique index tasks_fair_template_uq on public.tasks (fair_id, template_id) where template_id is not null;

alter table public.anchors
  add column area text not null default 'casa' check (area in ('casa', 'mwf'));

alter table public.settings
  add column workday_on date,
  add column mwf_notify text not null default 'aus' check (mwf_notify in ('aus', 'briefing', 'sofort'));

-- ---------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------

alter table public.fairs              enable row level security;
alter table public.checklist_template enable row level security;
alter table public.ideas              enable row level security;

grant select, insert, update, delete on public.fairs, public.checklist_template, public.ideas to authenticated;
grant all on public.fairs, public.checklist_template, public.ideas to service_role;

create policy "fairs: haushalt" on public.fairs
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "checklist_template: haushalt" on public.checklist_template
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "ideas: haushalt" on public.ideas
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

alter publication supabase_realtime add table public.fairs, public.checklist_template, public.ideas;

-- ---------------------------------------------------------------------------
-- Runde: Montag nach der letzten Messe bis zum Messetag
-- ---------------------------------------------------------------------------

/** Start der Runde einer Messe: Montag nach der vorigen Messe, sonst Montag sechs Wochen davor */
create or replace function public.mwf_round_start(p_household uuid, p_fair date)
returns date language plpgsql stable set search_path = public as $$
declare
  prev date;
  base date;
begin
  select max(date) into prev from public.fairs where household_id = p_household and date < p_fair;
  if prev is null then
    base := p_fair - 42;
    return base - (extract(isodow from base)::int - 1);
  end if;
  return prev - (extract(isodow from prev)::int - 1) + 7;
end $$;

/**
 * Fehlende Aufgaben der laufenden Runde anlegen (pro Haushalt die nächste Messe, deren Runde begonnen hat).
 * Idempotent: pro Vorlagenzeile und Messe höchstens eine Aufgabe. Erzeugte Aufgaben lösen keine Mitteilung aus
 * (updated_by = Besitzer, created_by leer).
 */
create or replace function public.mwf_generate_rounds()
returns integer language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/Berlin')::date;
  f record;
  t record;
  rstart date;
  due date;
  n integer := 0;
begin
  for f in
    select distinct on (household_id) id, household_id, date
    from public.fairs where date >= today
    order by household_id, date
  loop
    rstart := public.mwf_round_start(f.household_id, f.date);
    if today < rstart then continue; end if;
    for t in
      select * from public.checklist_template
      where household_id = f.household_id and area = 'mwf'
        and not exists (select 1 from public.tasks x where x.fair_id = f.id and x.template_id = checklist_template.id)
      order by sort
    loop
      due := case when t.days_before is null then rstart + 4 else f.date - t.days_before end;
      insert into public.tasks (household_id, area, title, owner_member_id, due_date, status, note, fair_id, template_id, is_running, created_by, updated_by)
      values (f.household_id, 'mwf', t.title, t.owner_member_id, due, 'offen', null, f.id, t.id, t.is_running, null, t.owner_member_id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

revoke all on function public.mwf_generate_rounds() from public;
grant execute on function public.mwf_generate_rounds() to authenticated, service_role;
grant execute on function public.mwf_round_start(uuid, date) to authenticated, service_role;

-- Täglich früh prüfen, ob eine neue Runde begonnen hat (Montag nach der Messe)
select cron.schedule('casa-mwf-runden', '0 4 * * *', $$select public.mwf_generate_rounds()$$);

-- ---------------------------------------------------------------------------
-- Push bei Aufgaben: Bereich mwf nur an Empfänger mit mwf_notify = sofort
-- ---------------------------------------------------------------------------

create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  verb text;
begin
  if actor is null then return new; end if;
  if new.status = 'erledigt' then return new; end if;

  if new.owner_member_id is null then
    -- offen: nur beim Anlegen oder wenn der Besitzer gerade entfernt wurde
    if tg_op = 'UPDATE' and old.owner_member_id is null then return new; end if;
    for r in
      select m.id from public.members m
      where m.household_id = new.household_id and m.role = 'partner' and m.id <> actor
        and (new.area <> 'mwf' or exists (select 1 from public.settings s where s.member_id = m.id and s.mwf_notify = 'sofort'))
    loop
      perform public.enqueue_notification(
        new.household_id, r.id, 'task',
        'Offen: ' || new.title,
        'bis ' || public.nice_date(new.due_date) || ' – wer übernimmt?',
        (case when new.area = 'mwf' then '#/mwf/todos' else '#/todos' end), 'task', new.id);
    end loop;
    return new;
  end if;

  if actor = new.owner_member_id then return new; end if;
  if new.area = 'mwf' and not exists (select 1 from public.settings s where s.member_id = new.owner_member_id and s.mwf_notify = 'sofort') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'erledigt' then return new; end if;
    if new.title = old.title and new.due_date = old.due_date and new.owner_member_id is not distinct from old.owner_member_id
       and new.note is not distinct from old.note and new.status = old.status then return new; end if;
    if new.owner_member_id is distinct from old.owner_member_id then verb := 'auf deinen Zettel';
    else verb := 'geändert'; end if;
  else
    verb := 'auf deinen Zettel';
  end if;
  perform public.enqueue_notification(
    new.household_id, new.owner_member_id, 'task',
    'Von ' || public.member_name(actor) || ' ' || verb,
    new.title || ' · bis ' || public.nice_date(new.due_date),
    (case when new.area = 'mwf' then '#/mwf/todos' else '#/todos' end), 'task', new.id);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Morgenbriefing: Bereich mwf nur, wenn mwf_notify = briefing oder sofort; laufende Punkte nie
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_briefings()
returns integer language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  today date := local_now::date;
  s record;
  heute text;
  morgen text;
  body text;
  n integer := 0;
begin
  for s in
    select st.member_id, m.household_id, (st.mwf_notify in ('briefing', 'sofort')) as with_mwf
    from public.settings st join public.members m on m.id = st.member_id
    where to_char(st.briefing_time, 'HH24:MI') = to_char(local_now, 'HH24:MI')
      and (st.last_opened_at is null or (st.last_opened_at at time zone 'Europe/Berlin')::date < today)
      and exists (select 1 from public.push_subscriptions p where p.member_id = st.member_id)
      and not exists (
        select 1 from public.notifications nt
        where nt.recipient_member_id = st.member_id and nt.kind = 'briefing'
          and (nt.created_at at time zone 'Europe/Berlin')::date = today)
  loop
    select string_agg(x, ', ' order by ord) into heute from (
      select 1 as ord, coalesce(to_char(e.start_time, 'HH24:MI') || ' ', '') || e.title as x, coalesce(e.start_time, '00:00'::time) as t
      from public.events e
      where e.household_id = s.household_id and e.date <= today and coalesce(e.end_date, e.date) >= today
        and (e.member_id is null or e.member_id = s.member_id)
      union all
      select 2, t.title, '23:59'::time
      from public.tasks t
      where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date = today
        and not t.is_running and (t.area = 'casa' or s.with_mwf)
      order by ord, t
    ) q;
    select string_agg(t.title, ', ' order by t.created_at) into morgen
    from public.tasks t
    where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date = today + 1
      and not t.is_running and (t.area = 'casa' or s.with_mwf);

    if heute is null and morgen is null then continue; end if;
    body := coalesce('heute: ' || heute, 'heute nichts');
    if morgen is not null then body := body || ' · morgen: ' || morgen; end if;

    insert into public.notifications (household_id, recipient_member_id, kind, title, body, url)
    values (s.household_id, s.member_id, 'briefing', 'Guten Morgen', body, '#/heute');
    n := n + 1;
  end loop;
  return n;
end $$;
