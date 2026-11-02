-- v8: Anker (laufende Lebensthemen) und offene Aufgaben
--  · anchors: Titel, warum, gemeinsam/privat, Phase, Notizen, letzte Bewegung, Archiv
--  · anchor_log: Verlauf (Schritt erledigt, Phase, Notiz, Frage geklärt, Sonntagsrunde)
--  · anchor_questions: offene Fragen, abhakbar
--  · anchor_pins: „Auf Startseite" pro Person
--  · tasks: anchor_id (Aufgabe gehört zu einem Anker), is_step (die Aufgabe IST der nächste Schritt),
--           owner_member_id darf leer sein = offen, noch niemand

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.anchors (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  why          text,
  visibility   text not null default 'shared' check (visibility in ('shared', 'private')),
  phase        text not null default 'idee' check (phase in ('idee', 'klaeren', 'testen', 'entscheiden', 'laeuft')),
  notes        text,
  -- Schritt erledigt, neuer noch nicht festgelegt: beim nächsten Öffnen „Und der nächste Schritt?"
  ask_next     boolean not null default false,
  moved_at     timestamptz not null default now(),
  archived_at  timestamptz,
  created_by   uuid references public.members(id),
  updated_by   uuid references public.members(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index anchors_household_idx on public.anchors (household_id);

create table public.anchor_log (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households(id) on delete cascade,
  anchor_id        uuid not null references public.anchors(id) on delete cascade,
  kind             text not null check (kind in ('step_done', 'phase', 'note', 'question', 'sunday')),
  text             text not null,
  author_member_id uuid references public.members(id),
  at               timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index anchor_log_anchor_idx on public.anchor_log (anchor_id, at desc);

create table public.anchor_questions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  anchor_id    uuid not null references public.anchors(id) on delete cascade,
  text         text not null check (length(trim(text)) > 0),
  resolved_at  timestamptz,
  sort         smallint not null default 0,
  created_by   uuid references public.members(id),
  created_at   timestamptz not null default now()
);
create index anchor_questions_anchor_idx on public.anchor_questions (anchor_id);

create table public.anchor_pins (
  member_id  uuid not null references public.members(id) on delete cascade,
  anchor_id  uuid not null references public.anchors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, anchor_id)
);

alter table public.tasks
  add column anchor_id uuid references public.anchors(id) on delete set null,
  add column is_step   boolean not null default false;
alter table public.tasks alter column owner_member_id drop not null;
create index tasks_anchor_idx on public.tasks (anchor_id) where anchor_id is not null;

create trigger anchors_touch before update on public.anchors for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rechte und RLS: Haushalt, und private Anker nur für den Ersteller
-- ---------------------------------------------------------------------------

alter table public.anchors          enable row level security;
alter table public.anchor_log       enable row level security;
alter table public.anchor_questions enable row level security;
alter table public.anchor_pins      enable row level security;

grant select, insert, update, delete on public.anchors, public.anchor_log, public.anchor_questions, public.anchor_pins to authenticated;
grant all on public.anchors, public.anchor_log, public.anchor_questions, public.anchor_pins to service_role;

create policy "anchors: haushalt, privat nur selbst" on public.anchors
  for all to authenticated
  using (household_id in (select public.my_household_ids()) and (visibility = 'shared' or created_by = public.my_member_id()))
  with check (household_id in (select public.my_household_ids()) and (visibility = 'shared' or created_by = public.my_member_id()));

-- Verlauf und Fragen: sichtbar, wenn der Anker sichtbar ist (die Anker-Policy greift im Unterabfrage-Select)
create policy "anchor_log: wie anker" on public.anchor_log
  for all to authenticated
  using (anchor_id in (select id from public.anchors))
  with check (anchor_id in (select id from public.anchors));

create policy "anchor_questions: wie anker" on public.anchor_questions
  for all to authenticated
  using (anchor_id in (select id from public.anchors))
  with check (anchor_id in (select id from public.anchors));

create policy "anchor_pins: eigene" on public.anchor_pins
  for all to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id() and anchor_id in (select id from public.anchors));

alter publication supabase_realtime add table public.anchors, public.anchor_log, public.anchor_questions, public.anchor_pins;

-- ---------------------------------------------------------------------------
-- Push bei Aufgaben: offene Aufgabe („wer übernimmt?") und wie bisher
--  · neu angelegt ohne Besitzer, oder Besitzer entfernt → alle anderen: „Offen: … · bis … – wer übernimmt?"
--  · übernehmen (leer → ich selbst) → nichts
--  · sonst wie bisher: vom anderen auf meinen Zettel / geändert
-- ---------------------------------------------------------------------------

create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(new.updated_by, new.created_by);
  r record;
  verb text;
begin
  if actor is null then return new; end if;
  if new.status = 'erledigt' then return new; end if;

  if new.owner_member_id is null then
    -- offen: nur beim Anlegen oder wenn der Besitzer gerade entfernt wurde
    if tg_op = 'UPDATE' and old.owner_member_id is null then return new; end if;
    for r in
      select id from public.members where household_id = new.household_id and role = 'partner' and id <> actor
    loop
      perform public.enqueue_notification(
        new.household_id, r.id, 'task',
        'Offen: ' || new.title,
        'bis ' || public.nice_date(new.due_date) || ' – wer übernimmt?',
        '#/todos', 'task', new.id);
    end loop;
    return new;
  end if;

  if actor = new.owner_member_id then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'erledigt' then return new; end if;
    if new.title = old.title and new.due_date = old.due_date and new.owner_member_id is not distinct from old.owner_member_id
       and new.note is not distinct from old.note and new.status = old.status then return new; end if;
    if new.owner_member_id is distinct from old.owner_member_id then verb := 'auf deinen Zettel';
    else verb := 'geändert'; end if;
  else
    verb := 'auf deinen Zettel';
  end if;
  perform public.enqueue_notification(
    new.household_id, new.owner_member_id, 'task',
    'Von ' || public.member_name(actor) || ' ' || verb,
    new.title || ' · bis ' || public.nice_date(new.due_date),
    '#/todos', 'task', new.id);
  return new;
end $$;
