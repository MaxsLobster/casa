-- Morgenbriefing: archivierte Aufgaben (Casa-Manager) nicht mehr nennen. Sonst unverändert.
CREATE OR REPLACE FUNCTION public.enqueue_briefings()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  today date := local_now::date;
  s record;
  heute text;
  morgen text;
  zurufe text;
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
        and not t.is_running and t.archived_at is null and (t.area = 'casa' or s.with_mwf)
      order by ord, t
    ) q;
    select string_agg(t.title, ', ' order by t.created_at) into morgen
    from public.tasks t
    where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date = today + 1
      and not t.is_running and t.archived_at is null and (t.area = 'casa' or s.with_mwf);
    zurufe := null;
    if s.with_mwf then
      select case count(*) when 0 then null when 1 then '1 Zuruf von ' || min(public.member_name(z.from_member_id))
             else count(*) || ' Zurufe von ' || string_agg(distinct public.member_name(z.from_member_id), ' und ') end
        into zurufe
      from public.shouts z
      where z.to_member_id = s.member_id and z.read_at is null and z.archived_at is null;
    end if;

    if heute is null and morgen is null and zurufe is null then continue; end if;
    body := coalesce('heute: ' || heute, 'heute nichts');
    if morgen is not null then body := body || ' · morgen: ' || morgen; end if;
    if zurufe is not null then body := body || ' · ' || zurufe; end if;

    insert into public.notifications (household_id, recipient_member_id, kind, title, body, url)
    values (s.household_id, s.member_id, 'briefing', 'Guten Morgen', body, '#/heute');
    n := n + 1;
  end loop;
  return n;
end $function$;
