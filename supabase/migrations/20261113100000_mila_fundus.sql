-- Mila · Fundus aus HelloFresh-Favoriten und Rezeptkarte
-- Erweitert die vorhandenen Tabellen. Die Rezeptdaten selbst kommen per Import-Skript
-- (scripts/import-fundus.mjs) direkt in die Datenbank und den Foto-Speicher, nicht ins Repo.

-- ---------------------------------------------------------------------------
-- Gerichte
-- ---------------------------------------------------------------------------
alter table public.mila_recipes
  add column if not exists hf_id          text,                         -- eindeutige HelloFresh-ID, Schlüssel für den Import
  add column if not exists source_url     text,
  add column if not exists subtitle       text,
  add column if not exists photo_path     text,                         -- Pfad im Speicher „mila-fotos“
  add column if not exists difficulty     text check (difficulty in ('leicht', 'mittel', 'aufwendig')),
  add column if not exists tags           text[] not null default '{}',
  add column if not exists cuisine        text[] not null default '{}',
  add column if not exists allergens      text[] not null default '{}',
  add column if not exists traces         text[] not null default '{}',
  add column if not exists utensils       text[] not null default '{}',
  add column if not exists optional_items text[] not null default '{}', -- „weglassbar“
  add column if not exists nutrition      jsonb,                        -- pro Portion: kcal, protein_g …
  add column if not exists prep_info      jsonb,                        -- tauglich, modus, satz, haltbar_tage
  add column if not exists device_tips    jsonb,                        -- thermomix, airfryer
  add column if not exists variants       jsonb,                        -- light / protein: tausch[], kcal_geschaetzt …
  add column if not exists kit            jsonb,
  add column if not exists anna           jsonb;                        -- paprika_ersetzt, hinweis
create unique index if not exists mila_recipes_hf_idx on public.mila_recipes (household_id, hf_id) where hf_id is not null;

-- ---------------------------------------------------------------------------
-- Zutaten und Schritte
-- ---------------------------------------------------------------------------
alter table public.mila_ingredients
  add column if not exists hint        text,                             -- ⓘ, z. B. Ersatz für eine HelloFresh-Zutat
  add column if not exists hf_original text,
  add column if not exists blend_key   text,                             -- Hausmischung, z. B. „hm-curry“
  add column if not exists anna_swap   boolean not null default false;

alter table public.mila_steps
  add column if not exists variant    text not null default 'original' check (variant in ('original', 'thermomix')),
  add column if not exists photo_path text,
  add column if not exists in_prep    boolean not null default false;
create index if not exists mila_steps_variant_idx on public.mila_steps (recipe_id, variant, position);

-- Woche: Variante, mit der gekocht und eingekauft wird
alter table public.mila_week_days
  add column if not exists variant text not null default 'original' check (variant in ('original', 'light', 'protein'));

-- ---------------------------------------------------------------------------
-- Hausmischungen (eigene Gewürzmischungen statt HelloFresh-Mischungen)
-- ---------------------------------------------------------------------------
create table if not exists public.mila_hausmischungen (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  key          text not null,                -- „hm-curry“
  name         text not null,
  ersetzt      text,
  glas_rezept  jsonb not null default '[]',  -- [{zutat, menge, einheit}]
  portion      text,
  haltbar      text,
  scharf       boolean not null default false,
  geschaetzt   boolean not null default true,
  hinweis      text,
  unique (household_id, key)
);
alter table public.mila_hausmischungen enable row level security;
grant select, insert, update, delete on public.mila_hausmischungen to authenticated;
grant all on public.mila_hausmischungen to service_role;
create policy "mila_hausmischungen: haushalt" on public.mila_hausmischungen
  for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

-- ---------------------------------------------------------------------------
-- Ladengänge: „Fleisch & Fisch“ kommt dazu („trocken“ heißt in der App jetzt „Vorrat“)
-- ---------------------------------------------------------------------------
alter table public.mila_ingredients drop constraint if exists mila_ingredients_shop_category_check;
alter table public.mila_ingredients add constraint mila_ingredients_shop_category_check
  check (shop_category in ('obst_gemuese', 'kuehl', 'fleisch_fisch', 'trocken', 'getraenke', 'sonstiges'));
alter table public.mila_shopping_items drop constraint if exists mila_shopping_items_category_check;
alter table public.mila_shopping_items add constraint mila_shopping_items_category_check
  check (category in ('obst_gemuese', 'kuehl', 'fleisch_fisch', 'trocken', 'getraenke', 'sonstiges'));

-- Fleisch und Fisch der bisherigen Gerichte aus dem Kühlregal umsortieren
update public.mila_ingredients set shop_category = 'fleisch_fisch'
where shop_category = 'kuehl'
  and lower(name) ~ '(hack|rind|schwein|hähnch|lamm|fisch|wurst|speck|garnele|lachs|steak|pute|chorizo|salami|schinken|chashu)'
  and lower(name) !~ '(fischsauce|brühe|fond)';
update public.mila_shopping_items set category = 'fleisch_fisch'
where category = 'kuehl'
  and lower(name) ~ '(hack|rind|schwein|hähnch|lamm|fisch|wurst|speck|garnele|lachs|steak|pute|chorizo|salami|schinken|chashu)'
  and lower(name) !~ '(fischsauce|brühe|fond)';

-- ---------------------------------------------------------------------------
-- Foto-Speicher: privat, lesen nur Mitglieder eines Haushalts, schreiben nur das Import-Skript
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mila-fotos', 'mila-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "mila-fotos: mitglieder lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'mila-fotos' and exists (select 1 from public.members m where m.user_id = auth.uid()));
