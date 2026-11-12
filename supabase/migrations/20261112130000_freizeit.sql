-- Casa · Bereich „Freizeit“
-- Ein Recherche-Bot liefert Wochenend-Tipps über die Edge Function „freizeit-api“.
-- Max und Anna lesen sie und geben Rückmeldung (Status + Notiz). Anlegen und Löschen geht nur über die Edge Function.

create table public.freizeit_radar (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  wochenende   date not null,              -- Datum des Samstags
  wetter       text,
  erstellt_am  timestamptz not null default now(),
  unique (household_id, wochenende)
);

create table public.freizeit_tipps (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  radar_id      uuid references public.freizeit_radar(id) on delete cascade,
  typ           text not null check (typ in ('haupt', 'planb', 'oma', 'vorschau', 'alarm')),
  titel         text not null check (length(trim(titel)) > 0),
  start         timestamptz,
  ende          timestamptz,
  ganztags      boolean not null default false,   -- keine Uhrzeit bekannt
  start_tag     date,                             -- Tag in Berlin, für die Doppel-Prüfung
  ort           text,
  fahrzeit_min  integer,
  preis         text,
  anmeldung     text not null default 'unbekannt' check (anmeldung in ('ja', 'nein', 'unbekannt')),
  frist         date,
  warum_valerie text,
  fuer_euch     text,
  hinweis       text,
  link          text,
  grund         text,                             -- nur bei Alarm
  status        text not null default 'neu' check (status in ('neu', 'machen', 'nix', 'gemacht')),
  notiz         text,
  feedback_von  uuid references public.members(id) on delete set null,
  feedback_am   timestamptz,
  event_id      uuid references public.events(id) on delete set null,  -- Eintrag in der Casa-Woche nach „Machen wir“
  erstellt_am   timestamptz not null default now()
);
create index freizeit_tipps_household_idx on public.freizeit_tipps (household_id, erstellt_am);
-- Doppelte Tipps: gleicher Link + gleicher Tag; ohne Link: gleicher Titel + gleicher Tag
create unique index freizeit_tipps_link_uniq on public.freizeit_tipps (household_id, link, coalesce(start_tag, '1900-01-01')) where link is not null;
create unique index freizeit_tipps_titel_uniq on public.freizeit_tipps (household_id, lower(titel), coalesce(start_tag, '1900-01-01')) where link is null;

alter table public.freizeit_radar enable row level security;
alter table public.freizeit_tipps enable row level security;

revoke all on public.freizeit_radar, public.freizeit_tipps from anon, authenticated;
grant select on public.freizeit_radar, public.freizeit_tipps to authenticated;
grant update (status, notiz, feedback_von, feedback_am, event_id) on public.freizeit_tipps to authenticated;
grant all on public.freizeit_radar, public.freizeit_tipps to service_role;

create policy "freizeit_radar: eigener haushalt lesen" on public.freizeit_radar for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "freizeit_tipps: eigener haushalt lesen" on public.freizeit_tipps for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "freizeit_tipps: rückmeldung geben" on public.freizeit_tipps for update to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

alter publication supabase_realtime add table public.freizeit_radar, public.freizeit_tipps;
