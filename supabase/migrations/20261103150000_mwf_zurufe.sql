-- Casa v9.2 · Zurufe: kurze Infos zwischen Max und Anna im Bereich MWF (keine Aufgaben, nur Text).
-- Mitteilungen folgen settings.mwf_notify: sofort = Push, briefing = Zeile im Morgenbriefing, aus = nur Punkt am Symbol.

create table public.shouts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  area           text not null default 'mwf' check (area in ('casa', 'mwf')),
  from_member_id uuid not null references public.members(id),
  to_member_id   uuid not null references public.members(id),
  text           text not null check (length(trim(text)) > 0 and length(text) <= 500),
  reply_to       uuid references public.shouts(id) on delete set null,
  read_at        timestamptz,
  archived_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index shouts_inbox_idx on public.shouts (household_id, to_member_id, archived_at, created_at desc);

alter table public.shouts enable row level security;
grant select, insert, update, delete on public.shouts to authenticated;
grant all on public.shouts to service_role;
create policy "shouts: haushalt" on public.shouts
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));
alter publication supabase_realtime add table public.shouts;

-- Push beim Eintreffen, nur wenn der Empfänger „sofort" eingestellt hat
create or replace function public.notify_shout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.settings s where s.member_id = new.to_member_id and s.mwf_notify = 'sofort') then
    perform public.enqueue_notification(
      new.household_id, new.to_member_id, 'shout',
      'Zuruf von ' || public.member_name(new.from_member_id),
      new.text, '#/mwf/zurufe', 'shout', new.id);
  end if;
  return new;
end $$;
create trigger shouts_notify after insert on public.shouts for each row execute function public.notify_shout();

-- Morgenbriefing: ungelesene Zurufe als eigene Zeile, wenn mwf_notify = briefing oder sofort
create or replace function public.enqueue_briefings()
returns integer language plpgsql security definer set search_path = public as $$
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
        and not t.is_running and (t.area = 'casa' or s.with_mwf)
      order by ord, t
    ) q;
    select string_agg(t.title, ', ' order by t.created_at) into morgen
    from public.tasks t
    where t.household_id = s.household_id and t.owner_member_id = s.member_id and t.status <> 'erledigt' and t.due_date = today + 1
      and not t.is_running and (t.area = 'casa' or s.with_mwf);
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
end $$;
