-- Casa v9 · Daten für den echten Haushalt (einmalig, nach der Migration 20261103100000_mwf_bereich.sql)
-- Messen 2026/2027, Checklisten-Vorlage, Jahrespunkt, vier Firmen-Anker, laufende Runde erzeugen,
-- Rundenpunkte mit Datum vor dem 2.11.2026 als erledigt markieren (außer „Eintrittskarten und -bänder bestellen").
-- Keine Mitteilungen: Rundenpunkte haben updated_by = Besitzer, Anker-Schritte updated_by = Max, Anna hat mwf_notify = aus.

do $$
declare
  h    uuid := 'c2695fb0-db9e-4b9b-af55-f67af54d7cf1';
  mx   uuid := '7497f5c9-f1b2-4286-bb4b-7e3642eacb66';
  an   uuid := '349d058d-62af-45aa-bbf2-7830b278ddb0';
  a    uuid;
  f    uuid;
  n    integer;
begin
  -- Messen
  insert into public.fairs (household_id, date) values
    (h, '2026-10-04'), (h, '2026-11-08'), (h, '2026-12-06'),
    (h, '2027-01-17'), (h, '2027-02-21'), (h, '2027-04-04'), (h, '2027-05-16'), (h, '2027-06-27'),
    (h, '2027-09-05'), (h, '2027-10-17'), (h, '2027-11-14'), (h, '2027-12-12')
  on conflict (household_id, date) do nothing;

  -- Vorlage der Runde
  insert into public.checklist_template (household_id, area, title, owner_member_id, section, days_before, is_running, sort) values
    (h, 'mwf', 'Kassenbuch, Zählprotokoll, Bargeld zur Bank', an, 'start', null, false, 1),
    (h, 'mwf', 'Rechnungsnummern vergeben (nach Zahlungseingang)', an, 'start', null, false, 2),
    (h, 'mwf', 'Offene Zahlungen nachfassen', an, 'start', null, false, 3),
    (h, 'mwf', 'Kurze Nachbesprechung (was lief gut/schlecht)', null, 'start', null, false, 4),
    (h, 'mwf', 'Online-Shop für die nächste Messe freischalten', an, 'start', 14, false, 5),
    (h, 'mwf', 'Instagram-Post, sobald die Tickets online sind', mx, 'start', 12, false, 6),
    (h, 'mwf', 'Standplan-Tabelle anlegen + Saalplan-App umstellen', mx, 'start', null, false, 7),
    (h, 'mwf', 'Saalplan groß oder klein festlegen', mx, 'start', null, false, 8),
    (h, 'mwf', 'Anfragen beantworten, Plätze vergeben', mx, 'until', 0, true, 9),
    (h, 'mwf', 'Halbjahres- und Jahresbucher eintragen', mx, 'until', 14, false, 10),
    (h, 'mwf', 'Eintrittskarten und -bänder bestellen', mx, 'before', 10, false, 11),
    (h, 'mwf', 'Rechnungen vorbereiten', mx, 'before', 3, false, 12),
    (h, 'mwf', 'iPads vorbereiten', mx, 'eve', 1, false, 13),
    (h, 'mwf', 'SumUp, Wechselgeld, Kasse', an, 'eve', 1, false, 14),
    (h, 'mwf', 'Check-in, Rechnungen, Kontrolle wer bezahlt hat', an, 'fair', 0, false, 15);

  -- Jahres-Checkliste
  insert into public.tasks (household_id, area, title, owner_member_id, due_date, status, is_yearly, created_by, updated_by)
  values (h, 'mwf', 'Marktfestsetzung', an, '2026-12-31', 'offen', true, mx, an);

  -- Firmen-Anker (Schritte als Aufgaben bis Mo 16.11.2026)
  insert into public.anchors (household_id, title, why, visibility, area, phase, notes, created_by, updated_by)
  values (h, 'Version 2.0 / 2027', 'Firma bis zur Sommerpause 2027 übersichtlich, automatisiert, ruhiger.', 'shared', 'mwf', 'klaeren',
          'Bausteine: Abrechnung und Bargeld 2027 (neue EU-Regeln ab Juli 2027), Anmeldung über die Homepage mit Freigabe per Klick, Preise und Regeln transparent. Erste Messe im September 2027 läuft als Version 2.0.', mx, mx)
  returning id into a;
  insert into public.tasks (household_id, area, title, owner_member_id, due_date, status, anchor_id, is_step, created_by, updated_by)
  values (h, 'mwf', 'Bausteine in eine Reihenfolge bringen', null, '2026-11-16', 'offen', a, true, mx, mx);
  insert into public.anchor_pins (member_id, anchor_id) values (mx, a);

  insert into public.anchors (household_id, title, why, visibility, area, phase, notes, created_by, updated_by)
  values (h, 'GmbH-Umwandlung', 'Persönliche Haftung loswerden, nicht mehr Single Point of Failure.', 'shared', 'mwf', 'idee',
          'Bisher nichts passiert, weil die Zukunft der Firma in der Schwebe war.', mx, mx)
  returning id into a;
  insert into public.tasks (household_id, area, title, owner_member_id, due_date, status, anchor_id, is_step, created_by, updated_by)
  values (h, 'mwf', 'Termin beim Steuerberater', mx, '2026-11-16', 'offen', a, true, mx, mx);
  insert into public.anchor_questions (household_id, anchor_id, text, sort, created_by) values
    (h, a, 'GmbH oder GmbH & Co. KG?', 0, mx),
    (h, a, 'Neues Zieldatum (1.1.2027 ist nicht mehr realistisch)?', 1, mx),
    (h, a, 'Mietvertrag Ballhausforum: Change-of-Control-Klausel?', 2, mx);
  insert into public.anchor_pins (member_id, anchor_id) values (mx, a);

  insert into public.anchors (household_id, title, why, visibility, area, phase, notes, created_by, updated_by)
  values (h, 'Zukunft der Firma & Wochenende unter einem Dach', 'Klar haben, welcher Weg: behalten (2.0), Mehrheit abgeben oder verkaufen – und wie Samstag (WTA) und Sonntag zusammengehören.', 'shared', 'mwf', 'klaeren', null, mx, mx)
  returning id into a;
  insert into public.tasks (household_id, area, title, owner_member_id, due_date, status, anchor_id, is_step, created_by, updated_by)
  values (h, 'mwf', 'Gespräch zu zweit: welcher Weg?', null, '2026-11-16', 'offen', a, true, mx, mx);

  insert into public.anchors (household_id, title, why, visibility, area, phase, notes, created_by, updated_by)
  values (h, 'Social Media & Image', 'Image und Aufklärung, nicht Reichweite.', 'shared', 'mwf', 'idee',
          'Instagram knapp 4.000 Follower, bisher nur ein Flyer-Post pro Messe.', mx, mx)
  returning id into a;
  insert into public.tasks (household_id, area, title, owner_member_id, due_date, status, anchor_id, is_step, created_by, updated_by)
  values (h, 'mwf', 'Zur nächsten Messe ein Post hinter den Kulissen', mx, '2026-11-16', 'offen', a, true, mx, mx);

  -- Laufende Runde (Messe 8.11.2026) erzeugen
  select public.mwf_generate_rounds() into n;
  raise notice 'Rundenpunkte angelegt: %', n;

  -- Ersteinrichtung: Punkte mit Datum vor dem 2.11.2026 gelten als erledigt, außer Eintrittskarten/Bänder
  select id into f from public.fairs where household_id = h and date = '2026-11-08';
  update public.tasks
     set status = 'erledigt', done_at = now()
   where fair_id = f and due_date < '2026-11-02' and not is_running
     and title not like 'Eintrittskarten%';
end $$;
