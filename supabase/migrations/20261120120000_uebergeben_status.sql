-- UX-Runde Teil 2: Übergeben mit Status, „gesehen“ und Mitteilungen bei Zusage/Erledigt.
-- Fügt hinzu: Tabelle slot_requests, Funktion answer_slot_request, Mitteilungs-Trigger dafür,
-- eine Lese-Regel für „gesehen“ im Haushalt. Passt an: Mitteilungen bei Aufgaben (zusätzlich an den,
-- der eingetragen hat), Woche-Mitteilung entfällt bei beantworteter Anfrage, Datumswort „morgen · Fr“,
-- manager_undo kennt slot_requests. Nichts wird gelöscht.

-- ---------------------------------------------------------------------------
-- 1 · Anfragen „Kannst du übernehmen?“ (Bringen, Holen, Kochen, Bett an einem Tag)
-- ---------------------------------------------------------------------------
create table public.slot_requests (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  date           date not null,
  slot           text not null check (slot in ('valerie_bringen', 'valerie_holen', 'valerie_tag', 'abend_essen', 'abend_bett')),
  at             time,
  from_member_id uuid not null references public.members(id) on delete cascade,
  to_member_id   uuid not null references public.members(id) on delete cascade,
  status         text not null default 'offen' check (status in ('offen', 'zugesagt', 'abgelehnt', 'zurueckgezogen')),
  note           text,
  answered_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index slot_requests_household_date_idx on public.slot_requests (household_id, date);
create unique index slot_requests_one_open on public.slot_requests (household_id, date, slot) where status = 'offen';
create trigger slot_requests_touch before update on public.slot_requests for each row execute function public.touch_updated_at();

alter table public.slot_requests enable row level security;
grant select, insert, update on public.slot_requests to authenticated;
grant all on public.slot_requests to service_role;

create policy "slot_requests: haushalt lesen" on public.slot_requests
  for select to authenticated using (household_id in (select public.my_household_ids()));
-- Fragen darf nur, wer selbst fragt, und nur jemanden aus dem eigenen Haushalt
create policy "slot_requests: selbst fragen" on public.slot_requests
  for insert to authenticated
  with check (household_id in (select public.my_household_ids())
              and from_member_id = public.my_member_id()
              and to_member_id in (select id from public.members where household_id = slot_requests.household_id)
              and status = 'offen');
-- Zurückziehen darf, wer gefragt hat (Antworten laufen über answer_slot_request)
create policy "slot_requests: eigene zurückziehen" on public.slot_requests
  for update to authenticated
  using (from_member_id = public.my_member_id() and status = 'offen')
  with check (from_member_id = public.my_member_id() and status in ('offen', 'zurueckgezogen'));

alter publication supabase_realtime add table public.slot_requests;

-- ---------------------------------------------------------------------------
-- 2 · Datumswort: „morgen · Fr“ statt „morgen“ und „Fr“ für denselben Tag
-- ---------------------------------------------------------------------------
create or replace function public.nice_date(d date)
returns text language plpgsql stable as $$
declare
  today date := (now() at time zone 'Europe/Berlin')::date;
  wd text[] := array['Mo','Di','Mi','Do','Fr','Sa','So'];
begin
  if d = today then return 'heute'; end if;
  if d = today + 1 then return 'morgen · ' || wd[extract(isodow from d)]; end if;
  if d > today and d < today + 7 then return wd[extract(isodow from d)]; end if;
  return to_char(d, 'FMDD.FMMM.');
end $$;

create or replace function public.slot_word(s text)
returns text language sql immutable as $$
  select case s when 'valerie_bringen' then 'Valerie bringen' when 'valerie_holen' then 'Valerie holen'
                when 'valerie_tag' then 'Valerie tagsüber' when 'abend_essen' then 'Kochen'
                when 'abend_bett' then 'ins Bett bringen' else s end
$$;

-- ---------------------------------------------------------------------------
-- 3 · Mitteilungen zu Anfragen: Frage an den anderen, Antwort an den Fragenden
-- ---------------------------------------------------------------------------
create or replace function public.notify_slot_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  what text := public.slot_word(new.slot) || ' · ' || public.nice_date(new.date)
               || case when new.at is not null then ' um ' || to_char(new.at, 'HH24:MI') else '' end;
begin
  if tg_op = 'INSERT' and new.status = 'offen' then
    perform public.enqueue_notification(new.household_id, new.to_member_id, 'request',
      public.member_name(new.from_member_id) || ' fragt: Kannst du übernehmen?', what, '#/heute', 'request', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'offen' and new.status in ('zugesagt', 'abgelehnt') then
    perform public.enqueue_notification(new.household_id, new.from_member_id, 'request',
      public.member_name(new.to_member_id) || case when new.status = 'zugesagt' then ' übernimmt' else ' kann leider nicht' end,
      what, '#/heute', 'request', new.id);
  end if;
  return new;
end $$;

create trigger slot_requests_notify after insert or update on public.slot_requests
  for each row execute function public.notify_slot_request();

-- ---------------------------------------------------------------------------
-- 4 · Antworten: Zusage trägt die Person für den Tag ein, Absage lässt alles, wie es ist
-- ---------------------------------------------------------------------------
create or replace function public.answer_slot_request(p_id uuid, p_yes boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_member_id();
  r public.slot_requests;
  my_name text;
begin
  select * into r from public.slot_requests where id = p_id for update;
  if r.id is null or r.to_member_id is distinct from me then raise exception 'Diese Anfrage gibt es nicht.'; end if;
  if r.status <> 'offen' then raise exception 'Diese Anfrage ist schon beantwortet.'; end if;

  update public.slot_requests set status = case when p_yes then 'zugesagt' else 'abgelehnt' end, answered_at = now() where id = p_id;

  if p_yes then
    select display_name into my_name from public.members where id = me;
    -- Keine zweite Mitteilung „hat die Woche geändert“ – die Antwort sagt schon alles
    perform set_config('casa.quiet_override', 'on', true);
    insert into public.week_overrides (household_id, date, slot, value, at, note, created_by, updated_by)
    values (r.household_id, r.date, r.slot, my_name, r.at, null, me, me)
    on conflict (household_id, date, slot) do update set value = excluded.value, at = coalesce(excluded.at, public.week_overrides.at), updated_by = me;
    perform set_config('casa.quiet_override', 'off', true);
  end if;
  return case when p_yes then 'zugesagt' else 'abgelehnt' end;
end $$;

revoke all on function public.answer_slot_request(uuid, boolean) from public, anon;
grant execute on function public.answer_slot_request(uuid, boolean) to authenticated;

-- Woche-Mitteilung: still, wenn sie aus einer beantworteten Anfrage stammt (sonst wie bisher)
create or replace function public.notify_override_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  slotname text;
begin
  if actor is null then return new; end if;
  if coalesce(current_setting('casa.quiet_override', true), '') = 'on' then return new; end if;
  slotname := case new.slot
    when 'valerie_bringen' then 'Valerie bringen' when 'valerie_holen' then 'Valerie holen'
    when 'valerie_tag' then 'Valerie tagsüber'
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

-- ---------------------------------------------------------------------------
-- 5 · Aufgaben: wer eingetragen hat, erfährt Zusage und Erledigt (sonst wie bisher)
-- ---------------------------------------------------------------------------
-- Grundlage: Fassung aus 20261103100000_mwf_bereich.sql (MWF-Regeln bleiben unverändert)
create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  verb text;
begin
  if actor is null then return new; end if;

  -- Neu: Zusage oder Erledigt durch die Person, die es hat → Mitteilung an den, der es eingetragen hat (nur Casa)
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('zugesagt', 'erledigt')
     and new.area = 'casa' and new.owner_member_id is not null and actor = new.owner_member_id
     and new.created_by is not null and new.created_by <> new.owner_member_id then
    perform public.enqueue_notification(
      new.household_id, new.created_by, 'task',
      public.member_name(actor) || case when new.status = 'zugesagt' then ' hat zugesagt' else ' hat erledigt' end,
      new.title, '#/todos', 'task', new.id);
    return new;
  end if;

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
-- 6 · „gesehen“: wer eingetragen hat, darf sehen, ob der andere die Aufgabe geöffnet hat
-- ---------------------------------------------------------------------------
create policy "seen: haushalt liest aufgaben" on public.item_seen
  for select to authenticated
  using (item_type = 'task' and member_id in (select id from public.members where household_id in (select public.my_household_ids())));

-- ---------------------------------------------------------------------------
-- 7 · manager_undo kennt die neue Tabelle (Manager kann „Frag Anna, ob sie Freitag holt“)
-- ---------------------------------------------------------------------------
create or replace function public.manager_undo(p_batch uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_member_id();
  allowed text[] := array['tasks', 'events', 'week_overrides', 'anchors', 'freizeit_tipps', 'house_entries', 'gift_people', 'gift_ideas',
                          'mila_week_plans', 'mila_plan_items', 'mila_week_days', 'mila_shopping_items', 'slot_requests'];
  r record;
  img jsonb;
  cols text;
  n integer := 0;
begin
  if me is null then
    raise exception 'Nicht angemeldet';
  end if;

  for r in
    select l.*
    from public.manager_log l
    where l.batch_id = p_batch
      and l.member_id = me
      and l.undone_at is null
      and l.created_at >= now() - interval '30 minutes'
      and l.household_id in (select public.my_household_ids())
    order by l.position desc, l.created_at desc
  loop
    if not (r.table_name = any(allowed)) then
      raise exception 'Rückgängig für % ist nicht vorgesehen', r.table_name;
    end if;
    img := coalesce(r.before, r.after);
    if img is null or (img ->> 'household_id')::uuid is distinct from r.household_id then
      raise exception 'Rückgängig: Zeile gehört nicht zum Haushalt';
    end if;

    if r.op = 'insert' then
      if r.table_name = 'gift_people' then
        update public.gift_people set archived_at = now() where id = r.row_id and household_id = r.household_id;
      elsif r.table_name = 'slot_requests' then
        -- Anfrage zurückziehen statt löschen (der andere hat sie evtl. schon gesehen)
        update public.slot_requests set status = 'zurueckgezogen' where id = r.row_id and household_id = r.household_id and status = 'offen';
      else
        execute format('delete from public.%I where id = $1 and household_id = $2', r.table_name) using r.row_id, r.household_id;
      end if;

    elsif r.op = 'update' then
      select string_agg(
               case when c.column_name = 'updated_by' then format('%I = %L::uuid', c.column_name, me)
                    else format('%I = r.%I', c.column_name, c.column_name) end, ', ')
        into cols
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = r.table_name
        and c.column_name not in ('id', 'created_at', 'updated_at')
        and (r.before ? c.column_name or c.column_name = 'updated_by');
      if cols is not null then
        execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.household_id = $3',
                       r.table_name, cols, r.table_name)
          using r.before, r.row_id, r.household_id;
      end if;

    elsif r.op = 'delete' then
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict (id) do nothing', r.table_name, r.table_name)
        using r.before;
    end if;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'Diese Änderung lässt sich nicht mehr zurücknehmen.';
  end if;

  update public.manager_log set undone_at = now()
  where batch_id = p_batch and member_id = me and undone_at is null;
  return n;
end $$;
