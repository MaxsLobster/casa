-- Casa · Bereich „Medikament“ (privates Add-on)
-- Alles hängt an einem Mitglied. Lesen und Schreiben darf nur dieses Mitglied (RLS), der Partner sieht nichts.
-- Ausnahme: „Annas Blick“ – der Partner schreibt und liest nur seine eigene Antwort, das Mitglied liest die Antworten über sich.

-- ---------------------------------------------------------------------------
-- Einstellungen: nur wer hier eine Zeile hat, hat den Bereich. Zeilen legt nur die Datenbank an.
-- ---------------------------------------------------------------------------

create table public.med_settings (
  member_id    uuid primary key references public.members(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  enabled      boolean not null default false,
  t_morning    time not null default '07:30',
  t_1          time not null default '11:00',
  t_2          time not null default '15:00',
  t_3          time not null default '20:00',
  ask_partner  boolean not null default false,
  t_partner    time not null default '20:30',
  updated_at   timestamptz not null default now()
);
create trigger med_settings_touch before update on public.med_settings for each row execute function public.touch_updated_at();

insert into public.med_settings (member_id, household_id)
select id, household_id from public.members where lower(email) = 'maxarmborst@gmail.com'
on conflict do nothing;

-- Medikament und Dosis mit Startdatum; name leer = „kein Medikament“
create table public.med_courses (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name         text,
  dose         text,
  start_date   date not null,
  created_at   timestamptz not null default now()
);
create index med_courses_member_idx on public.med_courses (member_id, start_date);

insert into public.med_courses (member_id, household_id, name, dose, start_date)
select member_id, household_id, 'Lisdexamfetamin', '30 mg', (now() at time zone 'Europe/Berlin')::date from public.med_settings;

-- Pro Tag: genommen um, Schlaf der letzten Nacht
create table public.med_days (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  taken_at     time,
  sleep        smallint check (sleep between 1 and 5),
  updated_at   timestamptz not null default now(),
  unique (member_id, date)
);

-- Check-ins: slot 1 = vormittags, 2 = nachmittags, 3 = abends
create table public.med_checkins (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  slot         smallint not null check (slot between 1 and 3),
  focus        smallint check (focus between 1 and 5),
  calm         smallint check (calm between 1 and 5),
  mood         smallint check (mood between 1 and 5),
  note         text,
  appetite     smallint check (appetite between 1 and 5),
  side_effects text[] not null default '{}',
  updated_at   timestamptz not null default now(),
  unique (member_id, date, slot)
);

-- Annas Blick: eine Antwort pro Tag
create table public.med_partner_answers (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  about_member_id uuid not null references public.members(id) on delete cascade,
  from_member_id  uuid not null references public.members(id) on delete cascade,
  date            date not null,
  value           smallint not null check (value between 1 and 5),
  note            text,
  updated_at      timestamptz not null default now(),
  unique (about_member_id, from_member_id, date)
);

-- Zustimmung des Partners (eigene Einstellung, Standard: aus)
alter table public.settings add column if not exists med_partner_ok boolean not null default false;

-- ---------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------

alter table public.med_settings        enable row level security;
alter table public.med_courses         enable row level security;
alter table public.med_days            enable row level security;
alter table public.med_checkins        enable row level security;
alter table public.med_partner_answers enable row level security;

grant select, update on public.med_settings to authenticated;
grant select, insert, update, delete on public.med_courses, public.med_days, public.med_checkins, public.med_partner_answers to authenticated;
grant all on public.med_settings, public.med_courses, public.med_days, public.med_checkins, public.med_partner_answers to service_role;

create policy "med_settings: eigene lesen" on public.med_settings for select to authenticated using (member_id = public.my_member_id());
create policy "med_settings: eigene ändern" on public.med_settings for update to authenticated using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

create policy "med_courses: eigene" on public.med_courses for all to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());
create policy "med_days: eigene" on public.med_days for all to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());
create policy "med_checkins: eigene" on public.med_checkins for all to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

-- Wer im Haushalt möchte von mir eine Abend-Einschätzung? Gibt nur die Mitglieds-ID zurück, sonst nichts.
create or replace function public.med_partner_asking()
returns uuid language sql stable security definer set search_path = public as $$
  select ms.member_id from public.med_settings ms
  where ms.enabled and ms.ask_partner
    and ms.member_id <> public.my_member_id()
    and ms.household_id in (select public.my_household_ids())
  limit 1;
$$;
revoke all on function public.med_partner_asking() from public;
grant execute on function public.med_partner_asking() to authenticated, service_role;

create policy "med_partner: lesen" on public.med_partner_answers for select to authenticated
  using (from_member_id = public.my_member_id() or about_member_id = public.my_member_id());
create policy "med_partner: eigene anlegen" on public.med_partner_answers for insert to authenticated
  with check (from_member_id = public.my_member_id() and about_member_id = public.med_partner_asking());
create policy "med_partner: eigene ändern" on public.med_partner_answers for update to authenticated
  using (from_member_id = public.my_member_id()) with check (from_member_id = public.my_member_id() and about_member_id = public.med_partner_asking());
create policy "med_partner: eigene löschen" on public.med_partner_answers for delete to authenticated
  using (from_member_id = public.my_member_id());

-- ---------------------------------------------------------------------------
-- Erinnerungen: minütlich die Uhrzeiten prüfen. Kein Medikamentenname im Text. Ruhezeiten gelten (enqueue_notification).
-- Nur wenn der Bereich an ist, Mitteilungen an sind und der Eintrag noch leer ist. Kein Nachhaken.
-- ---------------------------------------------------------------------------

create or replace function public.med_enqueue()
returns void language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  today date := local_now::date;
  hm text := to_char(local_now, 'HH24:MI');
  s record;
  p record;
  k integer;
  t time;
begin
  for s in
    select ms.* from public.med_settings ms
    where ms.enabled
  loop
    if exists (select 1 from public.push_subscriptions ps where ps.member_id = s.member_id) then
      if to_char(s.t_morning, 'HH24:MI') = hm
         and not exists (select 1 from public.med_days d where d.member_id = s.member_id and d.date = today and d.taken_at is not null) then
        perform public.enqueue_notification(s.household_id, s.member_id, 'med', 'Guten Morgen', 'Genommen? Und wie war die Nacht?', '#/med', null, null);
      end if;
      for k in 1..3 loop
        t := case k when 1 then s.t_1 when 2 then s.t_2 else s.t_3 end;
        if to_char(t, 'HH24:MI') = hm
           and not exists (select 1 from public.med_checkins c where c.member_id = s.member_id and c.date = today and c.slot = k) then
          perform public.enqueue_notification(s.household_id, s.member_id, 'med', 'Kurzer Check-in', 'Fokus, Ruhe, Stimmung · 10 Sekunden', '#/med/check/' || k, null, null);
        end if;
      end loop;
    end if;
    -- Annas Blick: nur mit ihrer Zustimmung
    if s.ask_partner and to_char(s.t_partner, 'HH24:MI') = hm then
      for p in
        select m.id from public.members m
        join public.settings st on st.member_id = m.id and st.med_partner_ok
        where m.household_id = s.household_id and m.role = 'partner' and m.id <> s.member_id
          and exists (select 1 from public.push_subscriptions ps where ps.member_id = m.id)
          and not exists (select 1 from public.med_partner_answers a where a.about_member_id = s.member_id and a.from_member_id = m.id and a.date = today)
      loop
        perform public.enqueue_notification(s.household_id, p.id, 'med', 'Wie war ' || public.member_name(s.member_id) || ' heute Abend?', 'Eine Frage, ein Tipp', '#/med/anna', null, null);
      end loop;
    end if;
  end loop;
end $$;
revoke all on function public.med_enqueue() from public;

select cron.schedule('casa-med', '* * * * *', $$select public.med_enqueue()$$);
