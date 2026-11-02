-- Casa v9.1 · einmalig: Rundenpunkte der Messe 8.11.2026 mit Datum vor dem 2.11.2026 als Altlast kennzeichnen
-- (die neun automatisch erledigten plus „Kurze Nachbesprechung", die wieder geöffnet wurde). Ausnahme: Eintrittskarten.
-- Keine Mitteilung: der Auslöser überspringt Aufgaben mit Status „erledigt".
do $$
declare
  h uuid := 'c2695fb0-db9e-4b9b-af55-f67af54d7cf1';
  f uuid;
  n integer;
begin
  select id into f from public.fairs where household_id = h and date = '2026-11-08';
  update public.tasks
     set is_skipped = true, status = 'erledigt', done_at = coalesce(done_at, now())
   where fair_id = f and due_date < '2026-11-02' and not is_running
     and title not like 'Eintrittskarten%';
  get diagnostics n = row_count;
  raise notice 'Altlasten: %', n;
end $$;
