-- Sonstiges: Hausbuch, Geschenk-Dose, Casa aufräumen (Bereiche, die niemand nutzt).
-- Nur Neues: drei Tabellen für Hausbuch/Geschenke, eine für „zuletzt geöffnet“, ein Feld in settings,
-- eine Erinnerungs-Funktion mit Cron. Bestehende Tabellen und Daten bleiben unverändert.

-- ---------------------------------------------------------------------------
-- Hausbuch (für beide): Bereiche frei, Einträge mit Titel, Wert, Datum, Notiz
-- ---------------------------------------------------------------------------
create table public.house_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  section      text not null default 'Rund ums Haus',      -- Für Gäste · Handwerker & Firmen · Zähler · Rund ums Haus · frei
  title        text not null,
  value        text,
  date         date,
  note         text,
  hidden       boolean not null default false,              -- erst nach Antippen sichtbar (z. B. Gäste-WLAN)
  position     integer not null default 0,
  created_by   uuid references public.members(id) on delete set null,
  updated_by   uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index house_entries_household_idx on public.house_entries (household_id, section, position);
create trigger house_entries_touch before update on public.house_entries for each row execute function public.touch_updated_at();
alter table public.house_entries enable row level security;
grant select, insert, update, delete on public.house_entries to authenticated;
grant all on public.house_entries to service_role;
create policy "house_entries: haushalt" on public.house_entries for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

-- ---------------------------------------------------------------------------
-- Geschenk-Dose: Personen (Geburtstag optional) und Ideen
-- Ideen für eine Person, die selbst Casa nutzt (member_id gesetzt), sieht nur, wer sie eingetragen hat.
-- ---------------------------------------------------------------------------
create table public.gift_people (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  name           text not null,
  birthday_day   smallint check (birthday_day between 1 and 31),
  birthday_month smallint check (birthday_month between 1 and 12),
  birth_year     smallint check (birth_year between 1900 and 2100),
  member_id      uuid references public.members(id) on delete set null,   -- Max oder Anna selbst
  note           text,
  archived_at    timestamptz,
  created_by     uuid references public.members(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((birthday_day is null) = (birthday_month is null))
);
create index gift_people_household_idx on public.gift_people (household_id);
create trigger gift_people_touch before update on public.gift_people for each row execute function public.touch_updated_at();
alter table public.gift_people enable row level security;
grant select, insert, update on public.gift_people to authenticated;
grant all on public.gift_people to service_role;
create policy "gift_people: haushalt" on public.gift_people for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create table public.gift_ideas (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  person_id    uuid not null references public.gift_people(id) on delete cascade,
  text         text not null,
  done_at      timestamptz,                                  -- verschenkt
  created_by   uuid not null references public.members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index gift_ideas_person_idx on public.gift_ideas (person_id, created_at);
create trigger gift_ideas_touch before update on public.gift_ideas for each row execute function public.touch_updated_at();
alter table public.gift_ideas enable row level security;
grant select, insert, update, delete on public.gift_ideas to authenticated;
grant all on public.gift_ideas to service_role;

-- privat = Idee für Max oder Anna selbst
create or replace function public.gift_is_private(p_person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gift_people p where p.id = p_person and p.member_id is not null)
$$;
revoke all on function public.gift_is_private(uuid) from public;
grant execute on function public.gift_is_private(uuid) to authenticated, service_role;

create policy "gift_ideas: lesen" on public.gift_ideas for select to authenticated
  using (household_id in (select public.my_household_ids())
         and (created_by = public.my_member_id() or not public.gift_is_private(person_id)));
create policy "gift_ideas: eintragen" on public.gift_ideas for insert to authenticated
  with check (household_id in (select public.my_household_ids()) and created_by = public.my_member_id());
create policy "gift_ideas: ändern" on public.gift_ideas for update to authenticated
  using (household_id in (select public.my_household_ids())
         and (created_by = public.my_member_id() or not public.gift_is_private(person_id)))
  with check (household_id in (select public.my_household_ids()));
create policy "gift_ideas: entfernen" on public.gift_ideas for delete to authenticated
  using (household_id in (select public.my_household_ids())
         and (created_by = public.my_member_id() or not public.gift_is_private(person_id)));

-- Startliste (Geburtstage trägt Max nach). Max und Anna selbst dazu, damit Ideen für sie privat bleiben.
insert into public.gift_people (household_id, name)
select h.id, n.name
from public.households h
cross join (values ('Opa Hannes'), ('Opa Manfred'), ('Oma'), ('Opa Rainer'), ('Onkel Flo'), ('Fabian'), ('Julia'), ('Kili'), ('Pauli')) as n(name);
insert into public.gift_people (household_id, name, member_id)
select m.household_id, m.display_name, m.id from public.members m where m.role = 'partner';

-- Erinnerung: 14 Tage vor einem Geburtstag an beide (nicht an das Geburtstagskind selbst),
-- mit den Ideen, die die jeweilige Person sehen darf. Einmal pro Person und Jahr.
create or replace function public.gift_birthday_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Europe/Berlin')::date + 14;
  p record; r record; ideas text; n integer := 0;
begin
  for p in
    select * from public.gift_people g
    where g.archived_at is null and g.birthday_month is not null
      and g.birthday_month = extract(month from d)
      and (g.birthday_day = extract(day from d)
           -- 29. Februar: in Nicht-Schaltjahren am 28.
           or (g.birthday_month = 2 and g.birthday_day = 29 and extract(day from d) = 28
               and extract(day from (make_date(extract(year from d)::int, 3, 1) - 1)) = 28))
  loop
    for r in
      select m.id from public.members m
      where m.household_id = p.household_id and m.role = 'partner' and m.id is distinct from p.member_id
        and not exists (
          select 1 from public.notifications nt
          where nt.recipient_member_id = m.id and nt.kind = 'gift' and nt.item_id = p.id
            and nt.created_at > now() - interval '300 days')
    loop
      select string_agg(i.text, ' · ' order by i.created_at) into ideas
      from public.gift_ideas i
      where i.person_id = p.id and i.done_at is null and (p.member_id is null or i.created_by = r.id);
      perform public.enqueue_notification(
        p.household_id, r.id, 'gift',
        p.name || ' hat in 14 Tagen Geburtstag',
        coalesce('Ideen: ' || ideas, 'Noch keine Idee in der Geschenk-Dose.'),
        '#/geschenke', 'gift', p.id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.gift_birthday_reminders() from public;
select cron.schedule('casa-geschenke', '0 8 * * *', $$select public.gift_birthday_reminders()$$);

-- ---------------------------------------------------------------------------
-- Casa aufräumen: wann wer welchen Bereich zuletzt geöffnet hat; Ausblenden pro Person
-- ---------------------------------------------------------------------------
create table public.area_visits (
  member_id    uuid not null references public.members(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  area         text not null,
  last_at      timestamptz not null default now(),
  primary key (member_id, area)
);
alter table public.area_visits enable row level security;
grant select, insert, update on public.area_visits to authenticated;
grant all on public.area_visits to service_role;
create policy "area_visits: haushalt lesen" on public.area_visits for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "area_visits: eigene schreiben" on public.area_visits for insert to authenticated
  with check (member_id = public.my_member_id() and household_id in (select public.my_household_ids()));
create policy "area_visits: eigene ändern" on public.area_visits for update to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

alter table public.settings add column if not exists hidden_areas text[] not null default '{}';

alter publication supabase_realtime add table public.house_entries, public.gift_people, public.gift_ideas;
