-- Mila · Wochenkarte wie HelloFresh
-- Gerichte bekommen Karten-Merkmale und Prep-Schritte, die Woche kennt Mittag und Abend,
-- dazu Wochenkarte, anonyme Stimmen, Rhythmus-Einstellungen und zwei Mitteilungen.
-- Die Rechnung (Karte, Treffer, Verteilung, Einkauf) läuft in der App und in der Edge Function „mila-tick“.

-- ---------------------------------------------------------------------------
-- Gerichte: neue Felder, Standards für den vorhandenen Fundus
-- ---------------------------------------------------------------------------

alter table public.mila_recipes
  add column if not exists meal        text not null default 'beides' check (meal in ('mittag', 'abend', 'beides')),
  add column if not exists label       text,                               -- Kartenkategorie (Familie, Vegetarisch …), leer = alte Kategorie
  add column if not exists blurb       text,                               -- ein Satz für die Karte, leer = erster Satz der Notiz
  add column if not exists valerie_mag boolean not null default false,
  add column if not exists cook_double boolean not null default false,     -- „doppelt → Mittag“
  add column if not exists prep_box    boolean not null default false;     -- komplett vorbereitbar

update public.mila_recipes set meal = 'abend' where category in ('wochenende', 'grill');
update public.mila_recipes set cook_double = true where category = 'mealprep';

-- Prep-Schritte: was sich am Sonntag vorbereiten lässt
create table public.mila_prep_steps (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  recipe_id      uuid not null references public.mila_recipes(id) on delete cascade,
  position       smallint not null default 0,
  text           text not null check (length(trim(text)) > 0),
  duration_min   integer,
  runs_alongside boolean not null default false,  -- läuft nebenbei (Reis, Ofen)
  box_label      text,                            -- was in die Box kommt, z. B. „Reis + Gemüse“
  day_before     boolean not null default false   -- erst am Vortag (marinieren) → Aufgabe
);
create index mila_prep_steps_recipe_idx on public.mila_prep_steps (recipe_id, position);

-- ---------------------------------------------------------------------------
-- Woche: Mittag und Abend pro Tag
-- ---------------------------------------------------------------------------

alter table public.mila_week_days
  add column if not exists meal        text not null default 'abend' check (meal in ('mittag', 'abend')),
  add column if not exists is_leftover boolean not null default false,     -- Reste vom Vorabend
  add column if not exists servings    integer;
alter table public.mila_week_days drop constraint if exists mila_week_days_household_id_date_key;
alter table public.mila_week_days add constraint mila_week_days_day_meal_key unique (household_id, date, meal);

-- Einkauf: „meist Vorrat“ steht grau vorab abgehakt
alter table public.mila_shopping_items add column if not exists is_stock boolean not null default false;

-- ---------------------------------------------------------------------------
-- Rhythmus pro Haushalt (Wochentage 1 = Mo … 7 = So, Zeiten in Berlin)
-- ---------------------------------------------------------------------------

create table public.mila_settings (
  household_id  uuid primary key references public.households(id) on delete cascade,
  lunches       smallint not null default 3 check (lunches between 0 and 5),
  dinners       smallint not null default 3 check (dinners between 0 and 5),
  card_weekday  smallint not null default 5 check (card_weekday between 1 and 7),
  card_time     time not null default '18:00',
  close_weekday smallint not null default 6 check (close_weekday between 1 and 7),
  close_time    time not null default '12:00',
  adopt_weekday smallint not null default 6 check (adopt_weekday between 1 and 7),
  adopt_time    time not null default '14:00',
  shop_weekday  smallint not null default 6 check (shop_weekday between 1 and 7),
  prep_weekday  smallint not null default 7 check (prep_weekday between 1 and 7),
  prep_time     time not null default '17:00',
  updated_at    timestamptz not null default now()
);
insert into public.mila_settings (household_id) select id from public.households on conflict do nothing;
create trigger mila_settings_touch before update on public.mila_settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Wochenkarte: eine Zeile pro Woche (Montag)
-- ---------------------------------------------------------------------------

create table public.mila_menus (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week         date not null,                         -- Montag der Woche, für die gewählt wird
  dinner_ids   uuid[] not null default '{}',          -- Abendkarte
  lunch_ids    uuid[] not null default '{}',          -- Mittagskarte
  opens_at     timestamptz not null,
  closes_at    timestamptz not null,
  adopt_at     timestamptz not null,                  -- spätestens dann automatisch übernehmen
  done_by      uuid[] not null default '{}',          -- wer fertig gewählt hat (nur das, nicht was)
  revealed_at  timestamptz,
  plan         jsonb,                                 -- Treffer, Reserve und Verteilung nach der Aufdeckung
  adopted_at   timestamptz,
  adopted_by   uuid references public.members(id),    -- leer = automatisch
  prep_done    text[] not null default '{}',          -- abgehakte Prep-Schritte
  created_by   uuid references public.members(id),    -- leer = Server
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, week)
);
create trigger mila_menus_touch before update on public.mila_menus for each row execute function public.touch_updated_at();

-- Stimmen: jeder sieht bis zur Aufdeckung nur die eigenen
create table public.mila_votes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  menu_id      uuid not null references public.mila_menus(id) on delete cascade,
  member_id    uuid not null references public.members(id),
  recipe_id    uuid not null references public.mila_recipes(id) on delete cascade,
  meal         text not null check (meal in ('mittag', 'abend')),
  vote         text not null check (vote in ('nein', 'ja', 'joker')),
  created_at   timestamptz not null default now(),
  unique (menu_id, member_id, meal, recipe_id)
);
-- Ein Joker pro Karte und Person
create unique index mila_votes_one_joker on public.mila_votes (menu_id, member_id, meal) where vote = 'joker';

-- ---------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------

alter table public.mila_prep_steps enable row level security;
alter table public.mila_settings   enable row level security;
alter table public.mila_menus      enable row level security;
alter table public.mila_votes      enable row level security;

grant select, insert, update, delete on public.mila_prep_steps, public.mila_settings, public.mila_menus, public.mila_votes to authenticated;
grant all on public.mila_prep_steps, public.mila_settings, public.mila_menus, public.mila_votes to service_role;

create policy "mila_prep_steps: haushalt" on public.mila_prep_steps
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "mila_settings: haushalt" on public.mila_settings
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "mila_menus: haushalt" on public.mila_menus
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

-- Ist die Karte schon aufgedeckt? (security definer, damit die Policy nicht an der RLS von mila_menus hängt)
create or replace function public.mila_menu_revealed(p_menu uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mila_menus where id = p_menu and revealed_at is not null);
$$;
revoke all on function public.mila_menu_revealed(uuid) from public;
grant execute on function public.mila_menu_revealed(uuid) to authenticated, service_role;

-- Lesen: eigene Stimmen immer, die des anderen erst nach der Aufdeckung
create policy "mila_votes: lesen" on public.mila_votes
  for select to authenticated
  using (household_id in (select public.my_household_ids())
         and (member_id = public.my_member_id() or public.mila_menu_revealed(menu_id)));
-- Schreiben: nur eigene, nur vor der Aufdeckung
create policy "mila_votes: eigene anlegen" on public.mila_votes
  for insert to authenticated
  with check (household_id in (select public.my_household_ids()) and member_id = public.my_member_id() and not public.mila_menu_revealed(menu_id));
create policy "mila_votes: eigene ändern" on public.mila_votes
  for update to authenticated
  using (member_id = public.my_member_id() and not public.mila_menu_revealed(menu_id))
  with check (member_id = public.my_member_id() and not public.mila_menu_revealed(menu_id));
create policy "mila_votes: eigene löschen" on public.mila_votes
  for delete to authenticated
  using (member_id = public.my_member_id() and not public.mila_menu_revealed(menu_id));

-- Fertig gewählt melden (oder zurücknehmen); sind beide fertig, wird sofort aufgedeckt
create or replace function public.mila_set_done(p_menu uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_member_id();
  m public.mila_menus%rowtype;
  partners integer;
begin
  select * into m from public.mila_menus where id = p_menu and household_id in (select public.my_household_ids()) for update;
  if not found or m.revealed_at is not null then return; end if;
  if p_done then
    if not me = any(m.done_by) then m.done_by := array_append(m.done_by, me); end if;
  else
    m.done_by := array_remove(m.done_by, me);
  end if;
  select count(*) into partners from public.members where household_id = m.household_id and role = 'partner';
  update public.mila_menus
     set done_by = m.done_by,
         revealed_at = case when cardinality(m.done_by) >= partners then now() else null end
   where id = p_menu;
end $$;
revoke all on function public.mila_set_done(uuid, boolean) from public;
grant execute on function public.mila_set_done(uuid, boolean) to authenticated, service_role;

alter publication supabase_realtime add table public.mila_menus, public.mila_votes;

-- ---------------------------------------------------------------------------
-- Mitteilungen (nur an Mitglieder mit eingeschalteten Casa-Mitteilungen; Ruhezeiten gelten)
-- ---------------------------------------------------------------------------

create or replace function public.notify_mila_menu()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer;
  except_id uuid;
  title text;
  body text;
  url text;
begin
  if tg_op = 'INSERT' then
    except_id := new.created_by;
    title := 'Die Wochenkarte ist da';
    body := 'Abendkarte und Mittagskarte · wählen bis ' || public.nice_date((new.closes_at at time zone 'Europe/Berlin')::date) || ' ' || to_char(new.closes_at at time zone 'Europe/Berlin', 'FMHH24') || ' Uhr';
    url := '#/mila/karte';
  elsif new.adopted_at is not null and old.adopted_at is null then
    except_id := new.adopted_by;
    n := coalesce(jsonb_array_length(new.plan -> 'slots'), 0);
    title := n || ' Mahlzeiten stehen';
    body := 'Einkaufszettel ist fertig';
    url := '#/mila/woche';
  else
    return new;
  end if;
  for r in
    select m.id from public.members m
    where m.household_id = new.household_id and m.role = 'partner'
      and m.id is distinct from except_id
      and exists (select 1 from public.push_subscriptions p where p.member_id = m.id)
  loop
    perform public.enqueue_notification(new.household_id, r.id, 'mila', title, body, url, null, null);
  end loop;
  return new;
end $$;
create trigger mila_menus_notify after insert or update of adopted_at on public.mila_menus
  for each row execute function public.notify_mila_menu();

-- ---------------------------------------------------------------------------
-- Takt: minütlich prüfen, ob eine Karte fällig ist, aufgedeckt oder übernommen werden muss.
-- Nur dann wird die Edge Function „mila-tick“ angestoßen (Adresse wie send-push, Schlüssel aus app_config).
-- ---------------------------------------------------------------------------

create or replace function public.mila_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  next_monday date := (date_trunc('week', local_now)::date + 7);
  need boolean;
  url text;
  key text;
begin
  select exists (
    select 1 from public.mila_settings s
    where local_now >= (next_monday - 7 + (s.card_weekday - 1)) + s.card_time
      and not exists (select 1 from public.mila_menus m where m.household_id = s.household_id and m.week = next_monday)
  ) or exists (
    select 1 from public.mila_menus m where m.revealed_at is null and m.closes_at <= now()
  ) or exists (
    select 1 from public.mila_menus m where m.adopted_at is null and m.adopt_at <= now() and m.week > local_now::date - 7
  ) into need;
  if not need then return; end if;
  select replace(value, 'send-push', 'mila-tick') into url from public.app_config where key = 'send_push_url';
  select value into key from public.app_config where key = 'cron_secret';
  if url is null or key is null then return; end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function public.mila_tick() from public;

select cron.schedule('casa-mila', '* * * * *', $$select public.mila_tick()$$);
