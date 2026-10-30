-- Casa · v2 · Schritt 1: Datenmodell-Erweiterungen und Push-Mitteilungen

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Personen ohne Login (Oma, Theresa …)
-- ---------------------------------------------------------------------------

create table public.people (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  kind         text not null default 'betreuung',   -- betreuung | familie | sonstige
  sort         smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (household_id, name)
);

insert into public.people (household_id, name, kind, sort)
select h.id, p.name, 'betreuung', p.sort
from public.households h, (values ('Oma', 1), ('Theresa', 2)) as p(name, sort);

-- ---------------------------------------------------------------------------
-- Mehrtägige Ereignisse, Wiederholungen, Personen, Bearbeiter
-- ---------------------------------------------------------------------------

alter table public.events
  add column end_date     date,
  add column repeat       text check (repeat in ('weekly', 'monthly', 'yearly')),
  add column repeat_until date,
  add column person_id    uuid references public.people(id) on delete set null,
  add column updated_by   uuid references public.members(id);

alter table public.tasks
  add column repeat       text check (repeat in ('weekly', 'monthly', 'yearly')),
  add column repeat_until date,
  add column updated_by   uuid references public.members(id);

alter table public.week_overrides
  add column updated_by   uuid references public.members(id);

-- ---------------------------------------------------------------------------
-- Einstellungen: Briefing, Ruhezeiten (standardmäßig aus), letzte Öffnung
-- ---------------------------------------------------------------------------

alter table public.settings
  add column briefing_time   time not null default '07:00',
  add column quiet_enabled   boolean not null default false,
  add column last_opened_at  timestamptz;

-- ---------------------------------------------------------------------------
-- Push-Abos, Gesehen-Markierungen, Mitteilungs-Warteschlange
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index push_subscriptions_member_idx on public.push_subscriptions (member_id);

create table public.item_seen (
  member_id  uuid not null references public.members(id) on delete cascade,
  item_type  text not null,            -- task | event | override
  item_id    uuid not null,
  seen_at    timestamptz not null default now(),
  primary key (member_id, item_type, item_id)
);

create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null references public.members(id) on delete cascade,
  kind                text not null,          -- task | event | override | briefing | test
  title               text not null,
  body                text not null,
  url                 text not null default '#/heute',
  item_type           text,
  item_id             uuid,
  created_at          timestamptz not null default now(),
  scheduled_for       timestamptz not null default now(),
  sent_at             timestamptz,
  error               text
);
create index notifications_pending_idx on public.notifications (scheduled_for) where sent_at is null;

-- Nur für Cron/Server: Adresse der Edge Function und Schlüssel. Keine API-Rechte.
create table public.app_config (
  key   text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------

alter table public.people             enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.item_seen          enable row level security;
alter table public.notifications      enable row level security;
alter table public.app_config         enable row level security;

grant select, insert, update, delete on public.people, public.push_subscriptions, public.item_seen, public.notifications to authenticated;
grant all on public.people, public.push_subscriptions, public.item_seen, public.notifications, public.app_config to service_role;

create policy "people: haushalt" on public.people
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "push: eigene" on public.push_subscriptions
  for all to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

create policy "seen: eigene" on public.item_seen
  for all to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

create policy "notifications: eigene lesen" on public.notifications
  for select to authenticated using (recipient_member_id = public.my_member_id());
create policy "notifications: test an sich selbst" on public.notifications
  for insert to authenticated
  with check (recipient_member_id = public.my_member_id() and household_id in (select public.my_household_ids()));

alter publication supabase_realtime add table public.people, public.item_seen;

-- ---------------------------------------------------------------------------
-- Helfer: Name eines Mitglieds, Datum hübsch, Sendezeitpunkt mit Ruhezeiten
-- ---------------------------------------------------------------------------

create or replace function public.member_name(m uuid)
returns text language sql stable security definer set search_path = public as $$
  select display_name from public.members where id = m;
$$;

-- „heute" · „morgen" · „Di" (diese Woche) · „15.11."
create or replace function public.nice_date(d date)
returns text language plpgsql stable as $$
declare
  today date := (now() at time zone 'Europe/Berlin')::date;
  wd text[] := array['Mo','Di','Mi','Do','Fr','Sa','So'];
begin
  if d = today then return 'heute'; end if;
  if d = today + 1 then return 'morgen'; end if;
  if d > today and d < today + 7 then return wd[extract(isodow from d)]; end if;
  return to_char(d, 'FMDD.FMMM.');
end $$;

-- Wann darf an dieses Mitglied geschickt werden? Jetzt, oder nach der Ruhezeit.
create or replace function public.next_send_time(recipient uuid)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings%rowtype;
  local_now timestamp := now() at time zone 'Europe/Berlin';
  t time := local_now::time;
  send_local timestamp;
begin
  select * into s from public.settings where member_id = recipient;
  if not found or not s.quiet_enabled then return now(); end if;
  if s.quiet_hours_start = s.quiet_hours_end then return now(); end if;
  if s.quiet_hours_start < s.quiet_hours_end then
    -- Ruhe am Tag, z. B. 13:00–15:00
    if t >= s.quiet_hours_start and t < s.quiet_hours_end then
      send_local := local_now::date + s.quiet_hours_end;
    else
      return now();
    end if;
  else
    -- Ruhe über Nacht, z. B. 21:00–07:00
    if t >= s.quiet_hours_start then
      send_local := (local_now::date + 1) + s.quiet_hours_end;
    elsif t < s.quiet_hours_end then
      send_local := local_now::date + s.quiet_hours_end;
    else
      return now();
    end if;
  end if;
  return send_local at time zone 'Europe/Berlin';
end $$;

create or replace function public.enqueue_notification(
  p_household uuid, p_recipient uuid, p_kind text, p_title text, p_body text, p_url text, p_item_type text, p_item_id uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (household_id, recipient_member_id, kind, title, body, url, item_type, item_id, scheduled_for)
  values (p_household, p_recipient, p_kind, p_title, p_body, p_url, p_item_type, p_item_id, public.next_send_time(p_recipient));
end $$;

-- ---------------------------------------------------------------------------
-- Sofort-Mitteilungen: Aufgaben, Termine, Abweichungen vom anderen
-- ---------------------------------------------------------------------------

create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  verb text;
begin
  if actor is null or actor = new.owner_member_id then return new; end if;
  if tg_op = 'UPDATE' then
    -- Abhaken oder Wiederöffnen: keine Mitteilung
    if new.status is distinct from old.status and (new.status = 'erledigt' or old.status = 'erledigt') then return new; end if;
    if new.title = old.title and new.due_date = old.due_date and new.owner_member_id = old.owner_member_id
       and new.note is not distinct from old.note and new.status = old.status then return new; end if;
    if new.owner_member_id <> old.owner_member_id then verb := 'auf deinen Zettel';
    else verb := 'geändert'; end if;
  else
    verb := 'auf deinen Zettel';
  end if;
  perform public.enqueue_notification(
    new.household_id, new.owner_member_id, 'task',
    'Von ' || public.member_name(actor) || ' ' || verb,
    new.title || ' · bis ' || public.nice_date(new.due_date),
    '#/offen', 'task', new.id);
  return new;
end $$;

create trigger tasks_notify after insert or update on public.tasks
  for each row execute function public.notify_task_change();

create or replace function public.notify_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  whenstr text;
begin
  if actor is null then return new; end if;
  if tg_op = 'UPDATE' and new.title = old.title and new.date = old.date and new.end_date is not distinct from old.end_date
     and new.start_time is not distinct from old.start_time and new.member_id is not distinct from old.member_id then
    return new;
  end if;
  whenstr := public.nice_date(new.date);
  if new.end_date is not null and new.end_date > new.date then
    whenstr := whenstr || '–' || public.nice_date(new.end_date);
  elsif new.start_time is not null then
    whenstr := whenstr || ' ' || to_char(new.start_time, 'HH24:MI');
  end if;
  for r in
    select id from public.members
    where household_id = new.household_id and role = 'partner' and id <> actor
      and (new.member_id is null or new.member_id = id)
  loop
    perform public.enqueue_notification(
      new.household_id, r.id, 'event',
      public.member_name(actor) || ' hat einen Termin ' || (case when tg_op = 'UPDATE' then 'geändert' else 'eingetragen' end),
      whenstr || ' ' || new.title,
      '#/woche', 'event', new.id);
  end loop;
  return new;
end $$;

create trigger events_notify after insert or update on public.events
  for each row execute function public.notify_event_change();

create or replace function public.notify_override_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  slotname text;
begin
  if actor is null then return new; end if;
  slotname := case new.slot
    when 'valerie_bringen' then 'Valerie bringen' when 'valerie_holen' then 'Valerie holen'
    when 'anna_arbeit' then 'Anna' when 'nachmittag' then 'Nachmittag'
    when 'abend_essen' then 'Abendessen' when 'abend_bett' then 'Ins Bett bringen'
    when 'wochenende' then 'Wochenende' else new.slot end;
  for r in
    select id from public.members where household_id = new.household_id and role = 'partner' and id <> actor
  loop
    perform public.enqueue_notification(
      new.household_id, r.id, 'override',
      public.member_name(actor) || ' hat die Woche geändert',
      public.nice_date(new.date) || ' · ' || slotname || ': ' || coalesce(new.value, 'offen')
        || (case when new.at is not null then ' um ' || to_char(new.at, 'HH24:MI') else '' end),
      '#/woche', 'override', new.id);
  end loop;
  return new;
end $$;

create trigger week_overrides_notify after insert or update on public.week_overrides
  for each row execute function public.notify_override_change();

-- ---------------------------------------------------------------------------
-- Morgenbriefing: minütlich prüfen, wer jetzt dran ist
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
    select st.member_id, m.household_id
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
      where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date <= today
      order by ord, t
    ) q;
    select string_agg(t.title, ', ' order by t.created_at) into morgen
    from public.tasks t
    where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date = today + 1;

    if heute is null and morgen is null then continue; end if;
    body := coalesce('heute: ' || heute, 'heute nichts');
    if morgen is not null then body := body || ' · morgen: ' || morgen; end if;

    insert into public.notifications (household_id, recipient_member_id, kind, title, body, url)
    values (s.household_id, s.member_id, 'briefing', 'Guten Morgen', body, '#/heute');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Versand anstoßen: ruft die Edge Function auf (Adresse und Schlüssel in app_config)
create or replace function public.trigger_send_push()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  url text;
  key text;
begin
  if not exists (select 1 from public.notifications where sent_at is null and scheduled_for <= now()) then return; end if;
  select value into url from public.app_config where key = 'send_push_url';
  select value into key from public.app_config where key = 'cron_secret';
  if url is null or key is null then return; end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', key),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end $$;

select cron.schedule('casa-briefings', '* * * * *', $$select public.enqueue_briefings()$$);
select cron.schedule('casa-send-push', '* * * * *', $$select public.trigger_send_push()$$);
-- Alte, verschickte Mitteilungen aufräumen (30 Tage)
select cron.schedule('casa-cleanup', '15 3 * * *', $$delete from public.notifications where sent_at < now() - interval '30 days'$$);
