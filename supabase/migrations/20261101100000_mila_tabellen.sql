-- Mila · Schritt 2 · Tabellen für den Essensplaner
-- Fünf Tabellen mit Präfix mila_. Rechte und RLS genau wie bei Casa:
-- alles hängt am Haushalt, nur Mitglieder des Haushalts lesen und schreiben.

-- ---------------------------------------------------------------------------
-- Gerichte
-- ---------------------------------------------------------------------------

create table public.mila_recipes (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households(id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  category         text not null default 'schnell'
                   check (category in ('schnell', 'mealprep', 'wochenende', 'grill', 'fruehstueck')),
  time_min         integer,
  portions         integer not null default 2 check (portions > 0),
  valerie_tauglich boolean not null default false,
  devices          text[] not null default '{}',   -- thermomix | pfanne | topf | wok | ofen | plancha | bge | dutch_oven
  notes            text,
  valerie_note     text,
  image_url        text,                           -- leer, für spätere Illustrationen
  created_by       uuid references public.members(id),
  updated_by       uuid references public.members(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index mila_recipes_household_idx on public.mila_recipes (household_id);

-- Zutaten eines Gerichts
create table public.mila_ingredients (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  recipe_id     uuid not null references public.mila_recipes(id) on delete cascade,
  position      smallint not null default 0,
  name          text not null check (length(trim(name)) > 0),
  amount        numeric,                           -- leer erlaubt („nach Geschmack“)
  unit          text not null default '',
  pantry_basic  boolean not null default false,    -- Basics kommen nicht auf die Einkaufsliste
  shop_category text not null default 'sonstiges'
                check (shop_category in ('obst_gemuese', 'kuehl', 'trocken', 'getraenke', 'sonstiges'))
);
create index mila_ingredients_recipe_idx on public.mila_ingredients (recipe_id, position);

-- Schritte eines Gerichts, normal oder Thermomix
create table public.mila_steps (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  recipe_id      uuid not null references public.mila_recipes(id) on delete cascade,
  position       smallint not null default 0,
  title          text,                             -- z. B. „Andünsten“
  text           text not null default '',
  timer_sec      integer,                          -- normaler Schritt mit Dauer
  is_thermomix   boolean not null default false,
  tm_time_sec    integer,
  tm_temp        text,                             -- „120“, „Varoma“ oder leer
  tm_speed       text,                             -- „1“, „5“, „Löffel“
  tm_reverse     boolean not null default false,   -- Linkslauf
  ingredient_ids uuid[] not null default '{}'      -- Zutaten dieses Schritts
);
create index mila_steps_recipe_idx on public.mila_steps (recipe_id, position);

-- ---------------------------------------------------------------------------
-- Woche: ein Abendessen pro Datum
-- ---------------------------------------------------------------------------

create table public.mila_week_days (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  date          date not null,
  recipe_id     uuid references public.mila_recipes(id) on delete set null,
  free_text     text,
  added_to_list boolean not null default false,
  created_by    uuid references public.members(id),
  updated_by    uuid references public.members(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, date)
);

-- ---------------------------------------------------------------------------
-- Einkaufsliste, live geteilt
-- ---------------------------------------------------------------------------

create table public.mila_shopping_items (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households(id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  amount            text not null default '',       -- „2 Stück“, „½ Bund“
  category          text not null default 'sonstiges'
                    check (category in ('obst_gemuese', 'kuehl', 'trocken', 'getraenke', 'sonstiges')),
  source_label      text,                           -- „Mo · Bolognese“, „Mi + Do“
  source_week       text,                           -- „2026-W45“: aus welcher Woche
  source_recipe_ids uuid[] not null default '{}',   -- damit nichts doppelt hinzukommt
  added_by          uuid references public.members(id),
  checked           boolean not null default false,
  checked_by        uuid references public.members(id),
  checked_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index mila_shopping_household_idx on public.mila_shopping_items (household_id, checked);

-- ---------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- ---------------------------------------------------------------------------

create trigger mila_recipes_touch   before update on public.mila_recipes   for each row execute function public.touch_updated_at();
create trigger mila_week_days_touch before update on public.mila_week_days for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rechte und RLS: nur der eigene Haushalt
-- ---------------------------------------------------------------------------

alter table public.mila_recipes        enable row level security;
alter table public.mila_ingredients    enable row level security;
alter table public.mila_steps          enable row level security;
alter table public.mila_week_days      enable row level security;
alter table public.mila_shopping_items enable row level security;

grant select, insert, update, delete on
  public.mila_recipes, public.mila_ingredients, public.mila_steps, public.mila_week_days, public.mila_shopping_items
  to authenticated;
grant all on
  public.mila_recipes, public.mila_ingredients, public.mila_steps, public.mila_week_days, public.mila_shopping_items
  to service_role;

create policy "mila_recipes: haushalt" on public.mila_recipes
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "mila_ingredients: haushalt" on public.mila_ingredients
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "mila_steps: haushalt" on public.mila_steps
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "mila_week_days: haushalt" on public.mila_week_days
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

create policy "mila_shopping_items: haushalt" on public.mila_shopping_items
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

-- ---------------------------------------------------------------------------
-- Realtime: Liste und Woche sofort beim anderen sichtbar
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.mila_shopping_items, public.mila_week_days;
