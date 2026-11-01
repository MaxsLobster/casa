-- v6: Ereignisse mit Wirkung auf die Normalwoche
-- effect: termin (nur Termin, wie bisher) · valerie_weg (bei Oma/Theresa, person_id) · kita_zu · eltern_weg (member_id = wer weg ist)
-- Übergabe bei „Valerie ist weg": wer bringt sie hin / holt sie ab, und wann.

alter table public.events
  add column if not exists effect     text not null default 'termin' check (effect in ('termin', 'valerie_weg', 'kita_zu', 'eltern_weg')),
  add column if not exists dropoff_by text,
  add column if not exists dropoff_at time,
  add column if not exists pickup_by  text,
  add column if not exists pickup_at  time;

-- ---------------------------------------------------------------------------
-- Push bei neuem/geändertem Ereignis
--  · eltern_weg: EINE Mitteilung an den anderen, mit Zahl der offenen Normalwoche-Einträge
--  · valerie_weg / kita_zu: „… hat eingetragen: Valerie bei Oma So–Di"
--  · termin: wie bisher
-- ---------------------------------------------------------------------------

create or replace function public.notify_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  whenstr text;
  away_name text;
  open_count integer;
  label text;
begin
  if actor is null then return new; end if;
  if tg_op = 'UPDATE' and new.title = old.title and new.date = old.date and new.end_date is not distinct from old.end_date
     and new.start_time is not distinct from old.start_time and new.member_id is not distinct from old.member_id
     and new.effect is not distinct from old.effect then
    return new;
  end if;
  whenstr := public.nice_date(new.date);
  if new.end_date is not null and new.end_date > new.date then
    whenstr := whenstr || '–' || public.nice_date(new.end_date);
  elsif new.start_time is not null then
    whenstr := whenstr || ' ' || to_char(new.start_time, 'HH24:MI');
  end if;

  if new.effect = 'eltern_weg' and new.member_id is not null then
    away_name := public.member_name(new.member_id);
    -- Normalwoche-Einträge an diesen Tagen, die bei der Person liegen und noch niemand übernommen hat
    select count(*) into open_count
    from generate_series(new.date, coalesce(new.end_date, new.date), interval '1 day') as d
    join public.normal_week nw on nw.household_id = new.household_id and nw.weekday = extract(isodow from d)
    where lower(coalesce(nw.value, '')) = lower(away_name)
      and nw.slot in ('valerie_bringen', 'valerie_holen', 'abend_essen', 'abend_bett')
      and not exists (select 1 from public.week_overrides o where o.household_id = new.household_id and o.date = d::date and o.slot = nw.slot);
    for r in
      select id from public.members
      where household_id = new.household_id and role = 'partner' and id <> actor
    loop
      perform public.enqueue_notification(
        new.household_id, r.id, 'event',
        (case when r.id = new.member_id then 'Du bist ' else away_name || ' ist ' end) || whenstr || ' weg',
        (case when open_count = 0 then 'Nichts offen.' when open_count = 1 then 'Offen: 1 Sache' else 'Offen: ' || open_count || ' Dinge' end),
        '#/woche', 'event', new.id);
    end loop;
    return new;
  end if;

  label := case new.effect when 'valerie_weg' then 'Valerie ist weg' when 'kita_zu' then 'Kita zu' else null end;
  for r in
    select id from public.members
    where household_id = new.household_id and role = 'partner' and id <> actor
      and (new.member_id is null or new.member_id = id)
  loop
    perform public.enqueue_notification(
      new.household_id, r.id, 'event',
      public.member_name(actor) || (case when label is null then ' hat einen Termin ' else ' hat ' || label || ' ' end)
        || (case when tg_op = 'UPDATE' then 'geändert' else 'eingetragen' end),
      whenstr || ' ' || new.title,
      '#/woche', 'event', new.id);
  end loop;
  return new;
end $$;

-- Abweichung: neuer Slot „valerie_tag" (Valerie tagsüber, wenn die Kita zu ist)
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
