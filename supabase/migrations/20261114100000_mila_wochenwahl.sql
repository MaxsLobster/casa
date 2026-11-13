-- Mila · Wochenwahl (Teil 2): Anzahl wählen, Stapel wischen, Treffer, Kombo als Kochreihenfolge, Heute dran.
-- Ersetzt die alte Wochenkarte (mila_menus / mila_votes bleiben als Verlauf, neue entstehen nicht mehr).
-- Datenschutz: Jeder liest nur seine eigenen Wischer. Treffer stehen ohne Namen in mila_matches,
-- Fortschritt und Kombo-Grundlage liefern abgesicherte Funktionen ohne Namen.

-- ---------------------------------------------------------------------------
-- Woche: Anzahl, Stapel, Status
-- ---------------------------------------------------------------------------
create table public.mila_week_plans (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  week           date not null,                                  -- Montag der Woche, für die gewählt wird
  abend_anzahl   smallint not null default 5 check (abend_anzahl between 3 and 6),
  mittag_anzahl  smallint not null default 2 check (mittag_anzahl between 0 and 4),
  deadline       timestamptz not null,                           -- So 20 Uhr (Berlin)
  status         text not null default 'wischen' check (status in ('wischen', 'kombo', 'aktiv', 'fertig')),
  deck           jsonb not null default '[]',                    -- [{recipe_id, meal}] gleich für beide
  deck_built_at  timestamptz,                                    -- ab dann ist die Anzahl fest
  beide_fertig_at timestamptz,
  kombo_at       timestamptz,
  adopted_at     timestamptz,
  adopted_by     uuid references public.members(id),
  einkauf_tag    date,
  prep_tag       date,
  prep_done      text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (household_id, week)
);
create trigger mila_week_plans_touch before update on public.mila_week_plans for each row execute function public.touch_updated_at();

-- Wischer: nur über mila_swipe() schreiben, lesen nur die eigenen
create table public.mila_swipes (
  id         uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plan_id    uuid not null references public.mila_week_plans(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  recipe_id  uuid not null references public.mila_recipes(id) on delete cascade,
  wahl       text not null check (wahl in ('ja', 'nein', 'stern')),
  created_at timestamptz not null default now(),
  unique (plan_id, member_id, recipe_id)
);

-- Treffer: beide ja oder ★, ohne Namen
create table public.mila_matches (
  id         uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plan_id    uuid not null references public.mila_week_plans(id) on delete cascade,
  recipe_id  uuid not null references public.mila_recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plan_id, recipe_id)
);

-- Kombo: Gerichte in Kochreihenfolge
create table public.mila_plan_items (
  id          uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plan_id     uuid not null references public.mila_week_plans(id) on delete cascade,
  recipe_id   uuid not null references public.mila_recipes(id) on delete cascade,
  slot        text not null check (slot in ('abend', 'mittag', 'reste')),
  gruppe      text not null check (gruppe in ('zuerst', 'prep', 'schluss')),
  position    smallint not null default 0,
  art         text not null default 'offen' check (art in ('joker', 'treffer', 'halb', 'offen', 'dazu')),
  portionen   smallint not null default 3,
  variante    text not null default 'original' check (variante in ('original', 'light', 'protein')),
  status      text not null default 'offen' check (status in ('offen', 'gekocht', 'eingefroren', 'getauscht', 'reserve')),
  frist_bis   date,
  parent_id   uuid references public.mila_plan_items(id) on delete cascade,  -- Reste → ihr Abendgericht
  geplant_am  date,                                                          -- „heute nehmen“
  gekocht_am  date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index mila_plan_items_plan_idx on public.mila_plan_items (plan_id, position);
create trigger mila_plan_items_touch before update on public.mila_plan_items for each row execute function public.touch_updated_at();

-- Haltbarkeit (geschätzt): Stichwort → Tage, null = unbegrenzt
create table public.mila_haltbarkeit_regeln (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  stichwort    text not null check (length(trim(stichwort)) > 0),
  tage         smallint check (tage between 0 and 60),
  gruppe       text not null default 'mittel' check (gruppe in ('kurz', 'mittel', 'lang', 'vorrat')),
  unique (household_id, stichwort)
);
insert into public.mila_haltbarkeit_regeln (household_id, stichwort, tage, gruppe)
select h.id, r.s, r.t, r.g from public.households h
cross join (values
  ('fisch', 1, 'kurz'), ('lachs', 1, 'kurz'), ('kabeljau', 1, 'kurz'), ('garnele', 1, 'kurz'),
  ('hack', 1, 'kurz'), ('hähnchen', 2, 'kurz'), ('huhn', 2, 'kurz'), ('pute', 2, 'kurz'), ('steak', 3, 'kurz'),
  ('salat', 2, 'mittel'), ('spinat', 2, 'mittel'), ('pak choi', 2, 'mittel'), ('rucola', 2, 'mittel'), ('avocado', 2, 'mittel'),
  ('petersilie', 3, 'mittel'), ('koriander', 3, 'mittel'), ('basilikum', 3, 'mittel'), ('schnittlauch', 3, 'mittel'), ('minze', 3, 'mittel'), ('dill', 3, 'mittel'), ('kräuter', 3, 'mittel'),
  ('pilz', 3, 'mittel'), ('champignon', 3, 'mittel'), ('brokkoli', 4, 'mittel'),
  ('tomate', 5, 'mittel'), ('gurke', 5, 'mittel'), ('zucchini', 5, 'mittel'),
  ('joghurt', 7, 'lang'), ('sahne', 7, 'lang'), ('käse', 7, 'lang'), ('skyr', 7, 'lang'), ('quark', 7, 'lang'),
  ('karotte', 10, 'lang'), ('kartoffel', 10, 'lang'), ('zwiebel', 10, 'lang'), ('kohl', 10, 'lang')
) as r(s, t, g)
on conflict do nothing;

-- Einkauf Montag (Tag 1), Prep-Stunde Montag 17 Uhr; neue Wahl öffnet Freitag, Frist Sonntag 20 Uhr
update public.mila_settings set shop_weekday = 1, prep_weekday = 1, prep_time = '17:00', card_weekday = 5, card_time = '00:00', close_weekday = 7, close_time = '20:00';
alter table public.mila_settings alter column shop_weekday set default 1, alter column prep_weekday set default 1, alter column card_weekday set default 5, alter column card_time set default '00:00', alter column close_weekday set default 7, alter column close_time set default '20:00';

-- ---------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------
alter table public.mila_week_plans enable row level security;
alter table public.mila_swipes enable row level security;
alter table public.mila_matches enable row level security;
alter table public.mila_plan_items enable row level security;
alter table public.mila_haltbarkeit_regeln enable row level security;

grant select, insert, update on public.mila_week_plans to authenticated;
grant select on public.mila_swipes, public.mila_matches to authenticated;
grant select, insert, update, delete on public.mila_plan_items, public.mila_haltbarkeit_regeln to authenticated;
grant all on public.mila_week_plans, public.mila_swipes, public.mila_matches, public.mila_plan_items, public.mila_haltbarkeit_regeln to service_role;

create policy "mila_week_plans: haushalt" on public.mila_week_plans for all to authenticated
  using (household_id in (select public.my_household_ids())) with check (household_id in (select public.my_household_ids()));
create policy "mila_swipes: nur eigene lesen" on public.mila_swipes for select to authenticated
  using (member_id = public.my_member_id());
create policy "mila_matches: haushalt lesen" on public.mila_matches for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "mila_plan_items: haushalt" on public.mila_plan_items for all to authenticated
  using (household_id in (select public.my_household_ids())) with check (household_id in (select public.my_household_ids()));
create policy "mila_haltbarkeit_regeln: haushalt" on public.mila_haltbarkeit_regeln for all to authenticated
  using (household_id in (select public.my_household_ids())) with check (household_id in (select public.my_household_ids()));

alter publication supabase_realtime add table public.mila_week_plans, public.mila_matches, public.mila_plan_items;

-- ---------------------------------------------------------------------------
-- Wischen: speichern, Sterne zählen, Treffer melden
-- ---------------------------------------------------------------------------
create or replace function public.mila_swipe(p_plan uuid, p_recipe uuid, p_wahl text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_member_id();
  p public.mila_week_plans%rowtype;
  stars integer;
  hit boolean := false;
  deck_n integer;
  partners integer;
  done_n integer;
begin
  if p_wahl not in ('ja', 'nein', 'stern') then raise exception 'wahl ungültig'; end if;
  select * into p from public.mila_week_plans where id = p_plan and household_id in (select public.my_household_ids()) for update;
  if not found then raise exception 'Woche nicht gefunden'; end if;
  if p.status <> 'wischen' or now() >= p.deadline then raise exception 'Die Wahl ist schon geschlossen'; end if;
  if not exists (select 1 from jsonb_array_elements(p.deck) d where (d->>'recipe_id')::uuid = p_recipe) then raise exception 'Gericht ist nicht im Stapel'; end if;
  if p_wahl = 'stern' then
    select count(*) into stars from public.mila_swipes where plan_id = p_plan and member_id = me and wahl = 'stern' and recipe_id <> p_recipe;
    if stars >= 2 then raise exception 'Beide Joker sind schon vergeben'; end if;
  end if;
  insert into public.mila_swipes (household_id, plan_id, member_id, recipe_id, wahl)
  values (p.household_id, p_plan, me, p_recipe, p_wahl)
  on conflict (plan_id, member_id, recipe_id) do update set wahl = excluded.wahl, created_at = now();

  hit := p_wahl <> 'nein' and exists (
    select 1 from public.mila_swipes s where s.plan_id = p_plan and s.recipe_id = p_recipe and s.member_id <> me and s.wahl in ('ja', 'stern'));
  if hit then
    insert into public.mila_matches (household_id, plan_id, recipe_id) values (p.household_id, p_plan, p_recipe) on conflict do nothing;
  else
    delete from public.mila_matches where plan_id = p_plan and recipe_id = p_recipe;
  end if;

  -- Sind beide durch den ganzen Stapel? Dann kann die Kombo sofort kommen
  deck_n := jsonb_array_length(p.deck);
  select count(*) into partners from public.members where household_id = p.household_id and role = 'partner';
  select count(*) into done_n from (
    select s.member_id from public.mila_swipes s where s.plan_id = p_plan group by s.member_id having count(*) >= deck_n
  ) x;
  if deck_n > 0 and done_n >= partners and p.beide_fertig_at is null then
    update public.mila_week_plans set beide_fertig_at = now() where id = p_plan;
  end if;

  select count(*) into stars from public.mila_swipes where plan_id = p_plan and member_id = me and wahl = 'stern';
  return jsonb_build_object('treffer', hit, 'joker_uebrig', greatest(0, 2 - stars));
end $$;

-- Nochmal von vorn: eigene Wischer löschen (Treffer, die daran hingen, verschwinden)
create or replace function public.mila_swipes_reset(p_plan uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_member_id();
begin
  if not exists (select 1 from public.mila_week_plans where id = p_plan and household_id in (select public.my_household_ids()) and status = 'wischen' and now() < deadline) then
    raise exception 'Die Wahl ist schon geschlossen';
  end if;
  delete from public.mila_matches m where m.plan_id = p_plan
    and exists (select 1 from public.mila_swipes s where s.plan_id = p_plan and s.member_id = me and s.recipe_id = m.recipe_id);
  delete from public.mila_swipes where plan_id = p_plan and member_id = me;
  update public.mila_week_plans set beide_fertig_at = null where id = p_plan;
end $$;

-- Fortschritt: nur Zahlen pro Person
create or replace function public.mila_wahl_stand(p_plan uuid)
returns table (member_id uuid, gewischt integer) language sql stable security definer set search_path = public as $$
  select m.id, (select count(*)::int from public.mila_swipes s where s.plan_id = p_plan and s.member_id = m.id)
  from public.members m
  join public.mila_week_plans p on p.id = p_plan and p.household_id = m.household_id
  where m.role = 'partner' and p.household_id in (select public.my_household_ids());
$$;

-- Grundlage der Kombo: pro Gericht nur die Art, ohne Namen; erst nach der Frist oder wenn beide fertig sind
create or replace function public.mila_kombo_eingang(p_plan uuid)
returns table (recipe_id uuid, art text) language sql stable security definer set search_path = public as $$
  select s.recipe_id,
         case when bool_or(s.wahl = 'stern') then 'joker'
              when count(*) filter (where s.wahl in ('ja', 'stern')) >= 2 then 'treffer'
              else 'halb' end
  from public.mila_swipes s
  join public.mila_week_plans p on p.id = s.plan_id
  where s.plan_id = p_plan
    and (p.household_id in (select public.my_household_ids()) or auth.role() = 'service_role')
    and (now() >= p.deadline or p.beide_fertig_at is not null)
  group by s.recipe_id
  having count(*) filter (where s.wahl in ('ja', 'stern')) >= 1;
$$;

revoke all on function public.mila_swipe(uuid, uuid, text), public.mila_swipes_reset(uuid), public.mila_wahl_stand(uuid), public.mila_kombo_eingang(uuid) from public;
grant execute on function public.mila_swipe(uuid, uuid, text), public.mila_swipes_reset(uuid), public.mila_wahl_stand(uuid), public.mila_kombo_eingang(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Takt: freitags neue Wahl anlegen, Kombo bauen (Frist vorbei oder beide fertig).
-- Die Arbeit macht die Edge Function „mila-tick“; hier nur prüfen, ob etwas fällig ist.
-- ---------------------------------------------------------------------------
create or replace function public.mila_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  local_now timestamp := now() at time zone 'Europe/Berlin';
  next_monday date := (date_trunc('week', local_now)::date + 7);
  need boolean;
  v_url text;
  v_key text;
begin
  select exists (
    select 1 from public.mila_settings s
    where local_now >= (next_monday - 7 + (s.card_weekday - 1)) + s.card_time
      and not exists (select 1 from public.mila_week_plans p where p.household_id = s.household_id and p.week = next_monday)
  ) or exists (
    select 1 from public.mila_week_plans p where p.status = 'wischen' and (p.deadline <= now() or p.beide_fertig_at is not null)
  ) into need;
  if not need then return; end if;
  select replace(c.value, 'send-push', 'mila-tick') into v_url from public.app_config c where c.key = 'send_push_url';
  select c.value into v_key from public.app_config c where c.key = 'cron_secret';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
