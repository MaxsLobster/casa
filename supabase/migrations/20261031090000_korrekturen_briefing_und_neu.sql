-- Korrekturen (31.10.2026):
-- 1. Morgenbriefing: nur eigene Aufgaben, die genau heute fällig sind (Überfälliges nicht mehr).
-- 2. NEU: alles, was vor dem Einführen der NEU-Funktion (30.10.2026, 19:30 Uhr) angelegt wurde,
--    gilt für beide als gesehen.

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
    select string_agg(x, ', ' order by ord, t) into heute from (
      select 1 as ord, coalesce(to_char(e.start_time, 'HH24:MI') || ' ', '') || e.title as x, coalesce(e.start_time, '00:00'::time) as t
      from public.events e
      where e.household_id = s.household_id and e.date <= today and coalesce(e.end_date, e.date) >= today
        and (e.member_id is null or e.member_id = s.member_id)
      union all
      -- nur meine Aufgaben, nur genau heute fällig
      select 2, t.title, '23:59'::time
      from public.tasks t
      where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date = today
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

-- Alte Einträge für beide als gesehen markieren
insert into public.item_seen (member_id, item_type, item_id, seen_at)
select m.id, 'task', t.id, now()
from public.tasks t join public.members m on m.household_id = t.household_id
where t.created_at < '2026-10-30 17:30:00+00'
on conflict do nothing;

insert into public.item_seen (member_id, item_type, item_id, seen_at)
select m.id, 'event', e.id, now()
from public.events e join public.members m on m.household_id = e.household_id
where e.created_at < '2026-10-30 17:30:00+00'
on conflict do nothing;

insert into public.item_seen (member_id, item_type, item_id, seen_at)
select m.id, 'override', o.id, now()
from public.week_overrides o join public.members m on m.household_id = o.household_id
where o.created_at < '2026-10-30 17:30:00+00'
on conflict do nothing;
