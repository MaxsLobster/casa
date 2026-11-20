-- UX-Runde Teil 3: neue Wiederholungen und vorgemerkte Gerichte.
-- Fügt hinzu: „alle 2 Wochen“ (biweekly) und „alle 4 Wochen“ (fourweekly) als erlaubte Wiederholung bei
-- Aufgaben und Terminen (die bisherigen Werte bleiben gültig) und die Tabelle mila_vormerkungen.
-- Nichts wird gelöscht.

alter table public.tasks drop constraint if exists tasks_repeat_check;
alter table public.tasks add constraint tasks_repeat_check check (repeat in ('weekly', 'biweekly', 'fourweekly', 'monthly', 'yearly'));
alter table public.events drop constraint if exists events_repeat_check;
alter table public.events add constraint events_repeat_check check (repeat in ('weekly', 'biweekly', 'fourweekly', 'monthly', 'yearly'));

-- Gerichte schon mal vormerken (jederzeit, auch bevor die Wahl startet); kommen in den nächsten Stapel
create table public.mila_vormerkungen (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id    uuid not null references public.mila_recipes(id) on delete cascade,
  member_id    uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (household_id, recipe_id)
);
alter table public.mila_vormerkungen enable row level security;
grant select, insert, delete on public.mila_vormerkungen to authenticated;
grant all on public.mila_vormerkungen to service_role;
create policy "mila_vormerkungen: haushalt" on public.mila_vormerkungen for all to authenticated
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));
alter publication supabase_realtime add table public.mila_vormerkungen;
