-- Test für manager_undo (Teil 1, Fehler 4). Läuft komplett in einer Transaktion und wird am Ende
-- zurückgerollt: Es bleibt nichts in der Datenbank. Aufruf: supabase db query --linked -f supabase/tests/manager_undo.sql
-- Nachgestellt wird „Wir haben nicht eingekauft“: neue Woche angelegt (Insert in mila_week_plans – das scheiterte früher
-- mit „permission denied“), eine Aufgabe geändert, eine Abweichung gelöscht. Rückgängig muss alles zurücknehmen.
begin;

insert into public.households (id, name) values ('00000000-0000-4000-8000-0000000000a1', 'Casa Test (Undo)');
insert into public.members (id, household_id, email, display_name, role)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'undo-test@casa-test.invalid', 'Test', 'partner');
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000c1', 'undo-test@casa-test.invalid', 'authenticated', 'authenticated');

-- Zustand NACH der Manager-Runde
insert into public.mila_week_plans (id, household_id, week, deadline, status)
values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1', '2026-11-30', now(), 'aktiv');
insert into public.tasks (id, household_id, title, owner_member_id, due_date, created_by, updated_by)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', 'Nachher', '00000000-0000-4000-8000-0000000000b1', '2026-11-24', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1');

-- Protokoll der Runde (wie es die Edge Function schreibt)
insert into public.manager_log (household_id, member_id, batch_id, position, table_name, row_id, op, before, after, summary) values
('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f1', 0, 'mila_week_plans', '00000000-0000-4000-8000-0000000000d2', 'insert', null,
 jsonb_build_object('id', '00000000-0000-4000-8000-0000000000d2', 'household_id', '00000000-0000-4000-8000-0000000000a1'), 'Test'),
('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f1', 1, 'tasks', '00000000-0000-4000-8000-0000000000e1', 'update',
 jsonb_build_object('id', '00000000-0000-4000-8000-0000000000e1', 'household_id', '00000000-0000-4000-8000-0000000000a1', 'title', 'Vorher', 'due_date', '2026-11-20',
                    'owner_member_id', '00000000-0000-4000-8000-0000000000b1', 'status', 'offen', 'area', 'casa', 'created_by', '00000000-0000-4000-8000-0000000000b1'), null, 'Test'),
('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f1', 2, 'week_overrides', '00000000-0000-4000-8000-0000000000e2', 'delete',
 jsonb_build_object('id', '00000000-0000-4000-8000-0000000000e2', 'household_id', '00000000-0000-4000-8000-0000000000a1', 'date', '2026-11-27', 'slot', 'valerie_holen', 'value', 'Oma',
                    'created_at', now(), 'updated_at', now()), null, 'Test');  -- vollständige Zeile, wie die Edge Function sie speichert

-- Als dieses Mitglied angemeldet (wie die App bzw. die Edge Function)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

do $$
declare n integer; ok boolean := false;
begin
  n := public.manager_undo('00000000-0000-4000-8000-0000000000f1');
  if n <> 3 then raise exception 'FEHLER: % statt 3 Schritte', n; end if;
  if exists (select 1 from public.mila_week_plans where id = '00000000-0000-4000-8000-0000000000d2') then raise exception 'FEHLER: neue Woche nicht entfernt'; end if;
  if (select title from public.tasks where id = '00000000-0000-4000-8000-0000000000e1') <> 'Vorher' then raise exception 'FEHLER: Aufgabe nicht zurückgesetzt'; end if;
  if (select due_date from public.tasks where id = '00000000-0000-4000-8000-0000000000e1') <> '2026-11-20' then raise exception 'FEHLER: Datum nicht zurückgesetzt'; end if;
  if (select value from public.week_overrides where id = '00000000-0000-4000-8000-0000000000e2') is distinct from 'Oma' then raise exception 'FEHLER: Abweichung nicht wiederhergestellt'; end if;
  if exists (select 1 from public.manager_log where batch_id = '00000000-0000-4000-8000-0000000000f1' and undone_at is null) then raise exception 'FEHLER: Protokoll nicht als zurückgenommen markiert'; end if;
  -- zweites Rückgängig muss sauber abgelehnt werden
  begin
    perform public.manager_undo('00000000-0000-4000-8000-0000000000f1');
  exception when others then ok := sqlerrm like '%nicht mehr zurücknehmen%';
  end;
  if not ok then raise exception 'FEHLER: zweites Rückgängig nicht abgelehnt'; end if;
  raise notice 'OK: manager_undo nimmt alle 3 Schritte zurück';
end $$;

select 'manager_undo: alle Prüfungen bestanden' as ergebnis;
rollback;
