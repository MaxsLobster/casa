-- Casa · Phase 1 · Startdaten
-- Haushalt, Max und Anna, Annas Normalwoche.
--
-- >>> WICHTIG: Die beiden E-Mail-Adressen unten vor dem Ausführen eintragen. <<<
-- Nur diese zwei Adressen können sich einloggen.

do $$
declare
  h uuid;
  max_email  text := 'max@beispiel.de';    -- <<< Max' Adresse
  anna_email text := 'anna@beispiel.de';   -- <<< Annas Adresse
begin
  insert into public.households (name) values ('Casa') returning id into h;

  insert into public.members (household_id, email, display_name, role) values
    (h, max_email,  'Max',  'partner'),
    (h, anna_email, 'Anna', 'partner');

  -- Falls sich jemand schon vor dem Seed registriert hat: nachträglich verknüpfen
  update public.members m
     set user_id = u.id
    from auth.users u
   where lower(u.email) = lower(m.email) and m.user_id is null;

  insert into public.settings (member_id)
    select id from public.members where household_id = h and user_id is not null
    on conflict do nothing;

  -- Normalwoche (weekday 1 = Montag)
  insert into public.normal_week (household_id, weekday, slot, value, at, is_open, note) values
    -- Montag
    (h, 1, 'valerie_bringen', 'Max',     null,    false, null),
    (h, 1, 'valerie_holen',   'Oma',     '14:00', false, null),
    (h, 1, 'anna_arbeit',     '8 Std.',  null,    false, null),
    (h, 1, 'abend_essen',     'Max',     null,    false, null),
    (h, 1, 'abend_bett',      'Anna',    null,    false, null),
    -- Dienstag
    (h, 2, 'valerie_bringen', 'Max',     null,    false, null),
    (h, 2, 'valerie_holen',   'Anna',    '14:00', false, null),
    (h, 2, 'anna_arbeit',     '4 Std.',  null,    false, null),
    (h, 2, 'abend_essen',     'Anna',    null,    false, null),
    (h, 2, 'abend_bett',      'Anna',    null,    false, 'vorerst'),
    -- Mittwoch
    (h, 3, 'valerie_bringen', 'Max',     null,    false, null),
    (h, 3, 'valerie_holen',   'Theresa', '14:00', false, 'Kann sie nicht, übernimmt Max.'),
    (h, 3, 'anna_arbeit',     '8 Std.',  null,    false, null),
    (h, 3, 'abend_essen',     null,      null,    true,  'wer kocht?'),
    (h, 3, 'abend_bett',      'Anna',    null,    false, null),
    -- Donnerstag
    (h, 4, 'valerie_bringen', 'Max',     null,    false, null),
    (h, 4, 'valerie_holen',   'Anna',    '13:00', false, null),
    (h, 4, 'nachmittag',      'Turnen 15–16 Uhr, danach Freunde', null, false, null),
    (h, 4, 'abend_essen',     'bei Freunden', null, false, null),
    (h, 4, 'abend_bett',      'Anna',    null,    false, null),
    -- Freitag
    (h, 5, 'valerie_bringen', 'Max',     null,    false, null),
    (h, 5, 'valerie_holen',   'Anna',    '14:00', false, null),
    (h, 5, 'anna_arbeit',     'frei',    null,    false, null),
    (h, 5, 'abend_essen',     null,      null,    true,  'Essen'),
    (h, 5, 'abend_bett',      null,      null,    true,  'Bettgehen'),
    -- Wochenende
    (h, 6, 'wochenende',      'Ein Familientag, ein Tag mit geteilter Betreuung, flexibel', null, true, 'welcher Tag ist Familientag?'),
    (h, 7, 'wochenende',      'Ein Familientag, ein Tag mit geteilter Betreuung, flexibel', null, true, 'welcher Tag ist Familientag?');
end $$;
