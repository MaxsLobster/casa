-- Mila · Schritt 2 · Rezepte aus der alten Mila-App (30 Gerichte)
-- Erzeugt von scripts/mila-import.mjs, bitte nicht von Hand ändern.
-- Mehrfaches Einspielen ist unschädlich (on conflict do nothing).

do $$
declare
  h  uuid;
  mx uuid;
begin
  select id into h from public.households order by created_at limit 1;
  select id into mx from public.members where lower(email) = 'maxarmborst@gmail.com' limit 1;

  -- Bolognese-Basis (Thermomix)
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('5ff85ae0-9552-52f8-af03-531f2674707b', h, 'Bolognese-Basis (Thermomix)', 'mealprep', 75, 8, true, array['thermomix']::text[], 'Dauerbrenner. Die Basis ergibt Cubes für Lasagne, Moussaka-Start, Chili, gefüllte Paprika.', 'Vor Pfeffer und starken Gewürzen 1 Schöpfer abnehmen – mild, nur Tomate + Hack. Parmesan drauf, fertig.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('1aaba84b-a473-5184-abbb-dad99f6326bf', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 0, 'Rinderhack (Bio)', 500, 'g', false, 'kuehl'),
    ('3714ddd5-ed6a-53f9-a3c5-128c58e7e629', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 1, 'Schweinehack', 200, 'g', false, 'kuehl'),
    ('475e2b22-bc99-537b-a2a2-2788eded4742', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 2, 'Karotte', 1, 'Stück', false, 'obst_gemuese'),
    ('3cf09788-b42f-51a9-a281-b927fba19161', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 3, 'Sellerie', 1, 'Stange', false, 'obst_gemuese'),
    ('06a08baa-1dc4-5fef-ae20-e3409c0019ac', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 4, 'Zwiebel', 1, 'Stück', true, 'obst_gemuese'),
    ('0c3efae4-4a83-5f77-a0ad-a2b59a64ba97', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 5, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('c05203fd-f973-5caa-acd6-6b15fbb1af4d', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 6, 'Olivenöl', 2, 'EL', true, 'trocken'),
    ('63e1844f-41d5-5323-a1c8-0f2a1708e24d', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 7, 'Dosentomaten (gehackt)', 800, 'g', true, 'trocken'),
    ('5f09839f-f6df-54a9-ad1c-cfe9f8ad49c5', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 8, 'Rotwein', 200, 'ml', false, 'getraenke'),
    ('b2296a72-3bcb-5712-adc9-2e393e21fb3a', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 9, 'Tomatenmark', 1, 'EL', true, 'trocken'),
    ('fa04ac03-acd1-594f-aa27-b27153753ccd', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 10, 'Lorbeerblatt, Oregano, Salz, Pfeffer', null, '', true, 'sonstiges'),
    ('2434c0fd-19e9-57a8-adc9-d9f93b90ca6c', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 11, 'Milch', 50, 'ml', false, 'kuehl')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('6e10688e-2e13-593e-a91b-2e36599a0d7b', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 0, 'Zerkleinern', 'Sellerie, Karotte, Zwiebel, Knoblauch in den Thermomix', null, true, 5, '', '5', false, array['475e2b22-bc99-537b-a2a2-2788eded4742', '3cf09788-b42f-51a9-a281-b927fba19161', '06a08baa-1dc4-5fef-ae20-e3409c0019ac', '0c3efae4-4a83-5f77-a0ad-a2b59a64ba97']::uuid[]),
    ('20d3aef0-c2af-538b-a4a7-473c8b0ab10d', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 1, 'Andünsten', 'Olivenöl dazu', null, true, 300, '120', '1', false, array['c05203fd-f973-5caa-acd6-6b15fbb1af4d']::uuid[]),
    ('b23c829b-cff2-5e52-ae4f-3a81cf527b13', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 2, 'Anbraten', 'Hack + Tomatenmark + Gewürze zugeben', null, true, 480, '100', '1', true, array['1aaba84b-a473-5184-abbb-dad99f6326bf', '3714ddd5-ed6a-53f9-a3c5-128c58e7e629', 'b2296a72-3bcb-5712-adc9-2e393e21fb3a']::uuid[]),
    ('2008f988-e4c4-5a30-a553-9d5e1d7eee24', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 3, 'Reduzieren', 'Rotwein dazu', null, true, 300, 'Varoma', '1', true, array['5f09839f-f6df-54a9-ad1c-cfe9f8ad49c5']::uuid[]),
    ('aabf9a48-15d2-5a7b-a5a7-0dbdf2d13a3e', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 4, 'Simmern', 'Dosentomaten + Milch + Lorbeerblatt rein', null, true, 3600, '95', '1', true, array['63e1844f-41d5-5323-a1c8-0f2a1708e24d', 'fa04ac03-acd1-594f-aa27-b27153753ccd', '2434c0fd-19e9-57a8-adc9-d9f93b90ca6c']::uuid[]),
    ('e855bc29-7dde-5a90-a626-5d69edb0924a', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 5, null, 'Abschmecken. Mit Tagliatelle oder Rigatoni servieren.', null, false, null, null, null, false, '{}'::uuid[]),
    ('17e3f309-da64-5ff2-a868-30ef63e37d9d', h, '5ff85ae0-9552-52f8-af03-531f2674707b', 6, null, 'Portionieren: 2 Portionen heute, 2 Portionen Di (Tupper), Rest in XL-Silikon-Cubes einfrieren.', null, false, null, null, null, false, '{}'::uuid[])
    on conflict (id) do nothing;

  -- Pasta Aglio e Olio
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('05129a77-828a-544a-a83a-4b0bd74ab671', h, 'Pasta Aglio e Olio', 'schnell', 15, 3, true, array['pfanne', 'topf']::text[], 'Klassischer Stress-Notfall. Alles was du brauchst ist immer da.', 'Knoblauch + Chili weglassen. Olivenöl + Spaghetti + Parmesan – sie liebt "Butternudeln". Gurke + Tomate dazu.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('d9ff6616-6905-5023-a6de-82571d8529b8', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 0, 'Spaghetti (Bio)', 300, 'g', true, 'trocken'),
    ('21a7398f-8960-5f42-ad49-30aac8068d88', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 1, 'Knoblauch', 6, 'Zehen', true, 'obst_gemuese'),
    ('c59a5152-b0b2-59fe-a008-2160c48e6abb', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 2, 'Getrocknete Chili oder Chiliflocken', 1, 'TL', true, 'trocken'),
    ('038fd987-4b2a-5e92-a761-45ea291d1fd1', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 3, 'Olivenöl extra vergine', 80, 'ml', true, 'trocken'),
    ('98690033-90b6-5c26-a675-c1cf14703fad', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 4, 'Petersilie', 1, 'Bund', false, 'obst_gemuese'),
    ('0c1efdf9-735f-5659-a1f1-f7c7e2fe48d8', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 5, 'Parmesan', null, 'nach Geschmack', true, 'kuehl')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('380b816d-00a1-50b3-acb9-23088d1bfdc2', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 0, null, 'Spaghetti in reichlich Salzwasser al dente kochen. Einen Becher Nudelwasser aufheben.', null, false, null, null, null, false, array['d9ff6616-6905-5023-a6de-82571d8529b8']::uuid[]),
    ('5368fe94-4d6d-5a9d-a3ba-772ef0c2b2f8', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 1, null, 'Olivenöl in großer Pfanne auf mittlerer Hitze. Knoblauch in Scheiben + Chili zugeben und 4–5 min langsam goldbraun werden lassen (nicht verbrennen!).', 240, false, null, null, null, false, array['21a7398f-8960-5f42-ad49-30aac8068d88', 'c59a5152-b0b2-59fe-a008-2160c48e6abb', '038fd987-4b2a-5e92-a761-45ea291d1fd1']::uuid[]),
    ('1948a886-7301-5548-aa44-392f0c017413', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 2, null, 'Nudeln abgießen, direkt in die Pfanne. Schuss Nudelwasser dazu, kurz schwenken bis cremig.', null, false, null, null, null, false, '{}'::uuid[]),
    ('a13fd94d-aede-5db3-a653-45503ca3dc34', h, '05129a77-828a-544a-a83a-4b0bd74ab671', 3, null, 'Petersilie rein, Parmesan drüber, servieren.', null, false, null, null, null, false, array['98690033-90b6-5c26-a675-c1cf14703fad', '0c1efdf9-735f-5659-a1f1-f7c7e2fe48d8']::uuid[])
    on conflict (id) do nothing;

  -- Shakshuka
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('adaa2eb0-7224-5e07-a362-fd34cf328353', h, 'Shakshuka', 'schnell', 25, 3, true, array['pfanne']::text[], 'Abends als schnelle Brotzeit-Plus. Reste: Tomatensauce für morgen als Pasta-Basis.', 'Kleine Portion Tomatensauce vor dem Chili abnehmen. Für sie ein separates Spiegelei. Sie tunkt Brot in die milde Sauce.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('b84d120a-5dbf-563b-a65f-70c642088a8f', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 0, 'Paprika rot', 2, 'Stück', false, 'obst_gemuese'),
    ('fbb4ceef-785f-5d67-a636-a6eaf6791ad9', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 1, 'Zwiebel', 1, 'Stück', true, 'obst_gemuese'),
    ('182f4e21-d776-5b7d-a580-38d2db098a73', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 2, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('f19d2021-a13d-5be2-aedc-adf19c1587fa', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 3, 'Olivenöl', 2, 'EL', true, 'trocken'),
    ('929eecd3-ffa7-5455-a325-2ce1df3fd9dc', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 4, 'Kreuzkümmel, Paprika edelsüß, Paprika scharf', null, '', true, 'obst_gemuese'),
    ('eb1e1363-2096-5ccb-ad34-7520362dc108', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 5, 'Dosentomaten (gehackt)', 400, 'g', true, 'trocken'),
    ('4cb757fb-4a0c-5a18-ad8e-d45a4836a05f', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 6, 'Eier', 5, 'Stück', true, 'kuehl'),
    ('67470cdd-231a-5892-aeda-c7dbb6314468', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 7, 'Feta', 100, 'g', false, 'kuehl'),
    ('e1dc6b1f-d5bf-5199-a968-62012683c5d5', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 8, 'Petersilie oder Koriander', 0.5, 'Bund', false, 'obst_gemuese'),
    ('e7f87b84-7d15-52b7-a662-f414cd223d81', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 9, 'Fladenbrot', null, 'zum Dippen', false, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('7021a235-8983-5f2f-a136-7425d066e7c4', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 0, null, 'Olivenöl in Pfanne. Zwiebel + Paprika 8 min anbraten bis weich.', 480, false, null, null, null, false, array['b84d120a-5dbf-563b-a65f-70c642088a8f', 'fbb4ceef-785f-5d67-a636-a6eaf6791ad9', 'f19d2021-a13d-5be2-aedc-adf19c1587fa', '929eecd3-ffa7-5455-a325-2ce1df3fd9dc']::uuid[]),
    ('b641ce25-f07d-580d-af71-2a526304b9bd', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 1, null, 'Knoblauch + Gewürze rein, 1 min mitbraten.', 60, false, null, null, null, false, array['182f4e21-d776-5b7d-a580-38d2db098a73']::uuid[]),
    ('82132e7f-66a3-5087-a357-79d7ec989229', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 2, null, 'Tomaten + Prise Zucker + Salz dazu, 8 min köcheln bis sämig.', 480, false, null, null, null, false, array['eb1e1363-2096-5ccb-ad34-7520362dc108']::uuid[]),
    ('48150e17-3d35-53a9-a9b9-fae3d873b9f7', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 3, null, 'Mit Löffel 5 Mulden in die Sauce drücken, in jede ein Ei schlagen.', null, false, null, null, null, false, array['4cb757fb-4a0c-5a18-ad8e-d45a4836a05f']::uuid[]),
    ('52e008dc-aea4-5666-a0ba-b5da3a5d681a', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 4, null, 'Deckel drauf, 5–7 min bei mittlerer Hitze – Eiweiß fest, Eigelb weich.', 300, false, null, null, null, false, '{}'::uuid[]),
    ('054f4e18-42c2-5e67-a5d5-6add265fed99', h, 'adaa2eb0-7224-5e07-a362-fd34cf328353', 5, null, 'Feta zerbröseln, Kräuter drüber. Mit Fladenbrot servieren.', null, false, null, null, null, false, array['67470cdd-231a-5892-aeda-c7dbb6314468', 'e7f87b84-7d15-52b7-a662-f414cd223d81']::uuid[])
    on conflict (id) do nothing;

  -- Thai-Erdnussnudeln
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', h, 'Thai-Erdnussnudeln', 'schnell', 20, 3, true, array['pfanne', 'wok', 'topf']::text[], 'Erdnuss-Sauce hält 3 Tage – Reste als Dip für Gemüsesticks.', 'Nudeln + geraspelte Karotte + ein paar Erdnüsse + milde Sauce (ohne Chili, mehr Erdnussbutter + Honig). Sie liebt''s.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('f955aca9-4880-5f74-a673-e11cde633e9a', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 0, 'Reisnudeln (flach, Pad-Thai-Style)', 300, 'g', true, 'trocken'),
    ('850ff569-ecce-54eb-a73c-4c682888a537', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 1, 'Hähnchenbrust oder Tofu', 200, 'g', false, 'kuehl'),
    ('9cf4b93b-c1d8-541c-ac0d-5222d0b363b5', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 2, 'Karotte', 1, 'Stück', false, 'obst_gemuese'),
    ('4efbc34a-90e8-57bb-a03b-f818897af12f', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 3, 'Paprika', 1, 'Stück', false, 'obst_gemuese'),
    ('037f0129-a9b8-5946-a8c4-007ddb85cb11', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 4, 'Edamame (TK)', 1, 'Handvoll', false, 'sonstiges'),
    ('ef2b8302-2908-5bf7-a218-dad404e390c0', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 5, 'Lauchzwiebeln', 2, 'Stück', false, 'obst_gemuese'),
    ('34ef4bea-ae0a-5542-a8e0-577f23ca349b', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 6, 'Erdnüsse (geröstet)', 1, 'Handvoll', true, 'trocken'),
    ('b92f4997-697e-50fa-ac09-8b1b34966f6e', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 7, 'Erdnussbutter', 4, 'EL', true, 'kuehl'),
    ('784d2c98-d157-57ed-a383-dd4c900a072a', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 8, 'Sojasauce', 2, 'EL', true, 'trocken'),
    ('47e0326e-a9e6-553a-a80b-d3617774d623', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 9, 'Reisessig', 1, 'EL', true, 'trocken'),
    ('7b2370db-6be8-566b-a79f-50419182ee27', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 10, 'Honig', 1, 'EL', true, 'trocken'),
    ('c7efff7d-8c60-52fd-a05a-e813e5be0bcc', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 11, 'Sesamöl + Limette + Ingwer', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('25349010-2c70-53f5-ae58-d0b10e1e7100', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 0, null, 'Reisnudeln nach Packung einweichen (meist heißes Wasser 8 min).', 480, false, null, null, null, false, array['f955aca9-4880-5f74-a673-e11cde633e9a']::uuid[]),
    ('9e1d4a0d-420b-5669-a0f7-6814db188cb7', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 1, null, 'Sauce: Erdnussbutter + Sojasauce + Reisessig + Honig + Sesamöl + Limettensaft + geriebener Ingwer + Chili + 3 EL heißes Wasser glatt rühren.', null, false, null, null, null, false, array['b92f4997-697e-50fa-ac09-8b1b34966f6e', '784d2c98-d157-57ed-a383-dd4c900a072a', '47e0326e-a9e6-553a-a80b-d3617774d623', '7b2370db-6be8-566b-a79f-50419182ee27', 'c7efff7d-8c60-52fd-a05a-e813e5be0bcc']::uuid[]),
    ('c54d894e-b23a-5111-abf6-c241de5f38ab', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 2, null, 'Hähnchen/Tofu in Pfanne 6 min anbraten. Rausnehmen.', 360, false, null, null, null, false, array['850ff569-ecce-54eb-a73c-4c682888a537']::uuid[]),
    ('569c31ae-f7dd-594f-adb8-a0ab60471d42', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 3, null, 'Karotte (Julienne) + Paprika + Edamame 3 min anbraten (noch knackig).', 180, false, null, null, null, false, array['9cf4b93b-c1d8-541c-ac0d-5222d0b363b5', '4efbc34a-90e8-57bb-a03b-f818897af12f', '037f0129-a9b8-5946-a8c4-007ddb85cb11']::uuid[]),
    ('792fcf68-52b2-505b-ad33-4a3a90a3444f', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 4, null, 'Nudeln + Fleisch wieder dazu, Sauce drüber, gut vermischen.', null, false, null, null, null, false, array['f955aca9-4880-5f74-a673-e11cde633e9a', '784d2c98-d157-57ed-a383-dd4c900a072a']::uuid[]),
    ('082fc24e-2888-5bf2-ab4d-95692e3ab07a', h, '3f8da2f2-60d0-55ed-a551-69bcfe2acdb8', 5, null, 'Mit Limette, Lauchzwiebel, Erdnüssen servieren.', null, false, null, null, null, false, array['ef2b8302-2908-5bf7-a218-dad404e390c0', '34ef4bea-ae0a-5542-a8e0-577f23ca349b', 'c7efff7d-8c60-52fd-a05a-e813e5be0bcc']::uuid[])
    on conflict (id) do nothing;

  -- Teriyaki-Hähnchen-Bowl
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('35f339b9-8fa9-504f-a8bc-270727c04dcc', h, 'Teriyaki-Hähnchen-Bowl', 'schnell', 25, 3, true, array['pfanne']::text[], 'Teriyaki-Sauce auf Vorrat machen (3× Menge) – hält 2 Wochen.', 'Hähnchen-Stücke vor der Sauce abnehmen (pur mit Mini-Sojasauce zum Dippen). Reis + Gurke + Edamame. Sie isst das zu 100%.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('88c0af5e-8ae7-5f8d-a90e-eb787d4ba715', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 0, 'Hähnchenschenkel ohne Knochen', 400, 'g', false, 'kuehl'),
    ('8848abe7-e24d-5d73-a4b5-1525dd5dd4c2', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 1, 'Sushi-Reis oder Basmati', 250, 'g', true, 'trocken'),
    ('8940d699-a9d6-54f1-a286-25f71dedecc6', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 2, 'Gurke', 1, 'Stück', false, 'obst_gemuese'),
    ('df49e07d-131a-544c-ac6e-0bc03bea5e43', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 3, 'Edamame (TK)', 100, 'g', false, 'sonstiges'),
    ('9895b332-ac1a-59e9-adf4-f45d806c01d7', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 4, 'Lauchzwiebel', 1, 'Stück', false, 'obst_gemuese'),
    ('2dea6930-b0bc-5a8f-a036-65870918ce3f', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 5, 'Sesam', null, '', true, 'sonstiges'),
    ('e89139a2-c01d-57a5-a7b6-ee68fd94ceec', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 6, 'Sojasauce', 3, 'EL', true, 'trocken'),
    ('2659a855-33c4-5c27-a0dc-cfc3e1272d24', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 7, 'Mirin', 2, 'EL', true, 'sonstiges'),
    ('8b6b253d-4921-5f8b-acad-4d7ebce06832', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 8, 'Sake oder trockener Sherry', 2, 'EL', true, 'sonstiges'),
    ('d9eaa672-fc00-5496-ab86-33bf4ccd68c7', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 9, 'Zucker', 1, 'EL', true, 'trocken'),
    ('12db4169-bcbf-5e6c-accf-093e958db028', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 10, 'Ingwer', 1, 'TL (gerieben)', true, 'obst_gemuese')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('3374c831-0be8-512d-ab51-0e0cb0b83706', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 0, null, 'Reis waschen, nach Packung kochen.', null, false, null, null, null, false, array['8848abe7-e24d-5d73-a4b5-1525dd5dd4c2']::uuid[]),
    ('3546dc67-b573-5320-a683-a3d0266ff8c3', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 1, null, 'Teriyaki-Zutaten in kleiner Schüssel mischen.', null, false, null, null, null, false, '{}'::uuid[]),
    ('991ae02f-ef15-543b-af18-476ea467e93d', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 2, null, 'Hähnchen in Pfanne hautseitig 6 min bei mittlerer Hitze goldbraun. Wenden, weitere 4 min.', 360, false, null, null, null, false, array['88c0af5e-8ae7-5f8d-a90e-eb787d4ba715']::uuid[]),
    ('611e667d-9c83-5216-ad0e-55aa698bfc84', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 3, null, 'Fett abgießen. Teriyaki-Sauce dazu, 2–3 min einkochen bis glasiert. Hähnchen in Streifen schneiden.', 120, false, null, null, null, false, array['88c0af5e-8ae7-5f8d-a90e-eb787d4ba715', 'e89139a2-c01d-57a5-a7b6-ee68fd94ceec']::uuid[]),
    ('d22c88f3-8bf3-5b36-a888-10a50b2b2f84', h, '35f339b9-8fa9-504f-a8bc-270727c04dcc', 4, null, 'Bowl bauen: Reis, Hähnchen, Gurke, Edamame. Sauce drüber, Sesam + Lauchzwiebel.', null, false, null, null, null, false, array['88c0af5e-8ae7-5f8d-a90e-eb787d4ba715', '8848abe7-e24d-5d73-a4b5-1525dd5dd4c2', '8940d699-a9d6-54f1-a286-25f71dedecc6', 'df49e07d-131a-544c-ac6e-0bc03bea5e43', '9895b332-ac1a-59e9-adf4-f45d806c01d7', '2dea6930-b0bc-5a8f-a036-65870918ce3f', 'e89139a2-c01d-57a5-a7b6-ee68fd94ceec']::uuid[])
    on conflict (id) do nothing;

  -- Korean Beef Bowl
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('91ce8e1d-094b-5721-a5fb-00418dec7ee7', h, 'Korean Beef Bowl', 'schnell', 20, 3, true, array['pfanne']::text[], 'Rest kalt in Salatblätter gewickelt (koreanisches Ssam) ist phänomenal.', 'Teil des Hacks vor Gochujang abnehmen. Reis + mildes Hack + Gurke + geraspelte Karotte. Kimchi nicht für sie.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('4d7a4417-dd55-5316-ac7f-5a5f39c39ac8', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 0, 'Rinderhack', 500, 'g', false, 'kuehl'),
    ('93712094-3624-5c03-a963-63963192ba96', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 1, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('6d80e440-c703-585f-a31d-b08f7e1fcc4e', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 2, 'Ingwer', 2, 'cm', true, 'obst_gemuese'),
    ('d2927904-cba5-5321-a8cf-2fe66a6565c2', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 3, 'Sojasauce', 4, 'EL', true, 'trocken'),
    ('be3ee4c5-abc6-50de-ad20-7a3e4da1f57e', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 4, 'Sesamöl', 2, 'EL', true, 'trocken'),
    ('8e09887f-2610-59d9-affd-048a95b0f905', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 5, 'Brauner Zucker', 2, 'EL', true, 'trocken'),
    ('502ca156-e46c-5292-a628-9a6af9782932', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 6, 'Gochujang (koreanische Chilipaste)', 1, 'TL (optional)', true, 'trocken'),
    ('59ce407e-378b-5b7e-aa20-48f96f38d3b0', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 7, 'Reis', 250, 'g', true, 'trocken'),
    ('ae59255f-e9c2-55db-a191-5bd1bf447122', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 8, 'Karotte', 1, 'Stück', false, 'obst_gemuese'),
    ('7ed9c658-e0fe-5efe-a2e9-11a453d9db16', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 9, 'Gurke', 1, 'Stück', false, 'obst_gemuese'),
    ('c545b3c9-89d0-5a22-a6f5-38f18e37a5cb', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 10, 'Lauchzwiebeln', 2, 'Stück', false, 'obst_gemuese'),
    ('8cf513cc-34d5-5411-a857-aacc1994c8bb', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 11, 'Sesam + Kimchi (gekauft)', null, '', false, 'sonstiges')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('65b595b4-43aa-5fcb-a77f-b5483366997e', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 0, null, 'Reis kochen.', null, false, null, null, null, false, array['59ce407e-378b-5b7e-aa20-48f96f38d3b0']::uuid[]),
    ('5b7ba581-d5cd-5eda-afa5-a472c669f9de', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 1, null, 'Hack in trockener Pfanne krümelig braten, Fett abgießen.', null, false, null, null, null, false, array['4d7a4417-dd55-5316-ac7f-5a5f39c39ac8']::uuid[]),
    ('c7951abe-e2e6-5eb4-ae56-7220b627a104', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 2, null, 'Knoblauch (gepresst) + Ingwer (gerieben) 30 Sek. mitbraten.', null, false, null, null, null, false, array['93712094-3624-5c03-a963-63963192ba96', '6d80e440-c703-585f-a31d-b08f7e1fcc4e']::uuid[]),
    ('fcce6a75-46d9-5df6-a60e-519ea4bb3c94', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 3, null, 'Sojasauce + Zucker + Sesamöl (+ optional Gochujang) rein, 2 min einkochen.', 120, false, null, null, null, false, array['d2927904-cba5-5321-a8cf-2fe66a6565c2', 'be3ee4c5-abc6-50de-ad20-7a3e4da1f57e', '8e09887f-2610-59d9-affd-048a95b0f905', '502ca156-e46c-5292-a628-9a6af9782932', '8cf513cc-34d5-5411-a857-aacc1994c8bb']::uuid[]),
    ('e1b13153-b7d5-56af-a931-df6a7682fce2', h, '91ce8e1d-094b-5721-a5fb-00418dec7ee7', 4, null, 'Bowl: Reis, Hack, Karotte (geraspelt), Gurke (in Stiften), Lauchzwiebel, Sesam. Kimchi separat.', null, false, null, null, null, false, array['4d7a4417-dd55-5316-ac7f-5a5f39c39ac8', 'be3ee4c5-abc6-50de-ad20-7a3e4da1f57e', '59ce407e-378b-5b7e-aa20-48f96f38d3b0', 'ae59255f-e9c2-55db-a191-5bd1bf447122', '7ed9c658-e0fe-5efe-a2e9-11a453d9db16', 'c545b3c9-89d0-5a22-a6f5-38f18e37a5cb', '8cf513cc-34d5-5411-a857-aacc1994c8bb']::uuid[])
    on conflict (id) do nothing;

  -- Linsen-Dal
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('91c25c4c-e3de-577a-a8b5-735eea6711d2', h, 'Linsen-Dal', 'mealprep', 30, 4, true, array['topf']::text[], 'Klassischer Mealprep-Kandidat. Hält 3 Tage, gefriert perfekt als Cube.', 'Vor dem Chili eine Portion abnehmen. Milder Dal + Reis + Joghurt-Klecks. Sie mag''s überraschend gern.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('edd2774d-4751-5dd8-a681-de3b7bbe8ce0', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 0, 'Rote Linsen', 250, 'g', true, 'trocken'),
    ('4abda403-5d04-5b97-a06b-f3d11547dee8', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 1, 'Zwiebel', 1, 'Stück', true, 'obst_gemuese'),
    ('9286f375-aea1-504d-aaa7-e7a8a5283cab', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 2, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('a4201cdb-7582-5835-abc2-ea2384e9408a', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 3, 'Ingwer', 2, 'cm', true, 'obst_gemuese'),
    ('a337aac8-54b4-594b-a879-f4c8f7ebf46d', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 4, 'Kokosmilch', 400, 'ml', true, 'trocken'),
    ('28e649e9-7b34-56a9-a403-40bd4b9314e3', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 5, 'Dosentomaten', 400, 'g', true, 'trocken'),
    ('13a69dc7-3bb1-57c5-a4b2-f46cb090bb66', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 6, 'Kurkuma, Kreuzkümmel (ganz), Garam Masala, Chili', null, '', true, 'obst_gemuese'),
    ('7c7200eb-11fc-5705-a7ca-bd26b5e4416f', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 7, 'Gemüsebrühe', 500, 'ml', true, 'trocken'),
    ('81218070-6f8a-5cc2-a43b-68a2da1e4ed1', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 8, 'Zitronensaft', 0.5, 'Zitrone', false, 'obst_gemuese'),
    ('4fa356a6-4069-5039-a1b2-519cab4f0a5b', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 9, 'Koriander', 0.5, 'Bund', false, 'obst_gemuese'),
    ('ebb6be97-5660-5bd8-a578-c9ebbe0e18bc', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 10, 'Basmati-Reis', null, 'als Beilage', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('5dc0d7fb-27aa-5a7e-a9b1-885a09180bed', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 0, null, 'Linsen abspülen. Zwiebel, Knoblauch, Ingwer fein hacken.', null, false, null, null, null, false, array['edd2774d-4751-5dd8-a681-de3b7bbe8ce0', '4abda403-5d04-5b97-a06b-f3d11547dee8', '9286f375-aea1-504d-aaa7-e7a8a5283cab', 'a4201cdb-7582-5835-abc2-ea2384e9408a']::uuid[]),
    ('6cc6b783-9915-5fca-a73f-44ccb2046ee6', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 1, null, 'In Topf Öl erhitzen, Kreuzkümmelsamen kurz rösten.', null, false, null, null, null, false, array['13a69dc7-3bb1-57c5-a4b2-f46cb090bb66']::uuid[]),
    ('2d444a6c-0939-5f75-aba0-83be19038b73', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 2, null, 'Zwiebel + Knoblauch + Ingwer 5 min anbraten.', 300, false, null, null, null, false, array['4abda403-5d04-5b97-a06b-f3d11547dee8', '9286f375-aea1-504d-aaa7-e7a8a5283cab', 'a4201cdb-7582-5835-abc2-ea2384e9408a']::uuid[]),
    ('680a14de-1fa4-54a9-aaea-9bc8703c05aa', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 3, null, 'Kurkuma + Garam Masala + Chili rein, 30 Sek.', null, false, null, null, null, false, array['13a69dc7-3bb1-57c5-a4b2-f46cb090bb66']::uuid[]),
    ('d831d492-f9cc-57f3-a113-1d292716d314', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 4, null, 'Tomaten + Linsen + Kokosmilch + Brühe dazu. Aufkochen, 20 min leise simmern bis Linsen zerfallen.', 1200, false, null, null, null, false, array['edd2774d-4751-5dd8-a681-de3b7bbe8ce0', 'a337aac8-54b4-594b-a879-f4c8f7ebf46d', '28e649e9-7b34-56a9-a403-40bd4b9314e3', '7c7200eb-11fc-5705-a7ca-bd26b5e4416f']::uuid[]),
    ('fac7b2e8-adb8-5980-ab5b-34fa4a055643', h, '91c25c4c-e3de-577a-a8b5-735eea6711d2', 5, null, 'Mit Zitrone + Salz abschmecken. Mit Koriander + Reis servieren.', null, false, null, null, null, false, array['81218070-6f8a-5cc2-a43b-68a2da1e4ed1', '4fa356a6-4069-5039-a1b2-519cab4f0a5b', 'ebb6be97-5660-5bd8-a578-c9ebbe0e18bc']::uuid[])
    on conflict (id) do nothing;

  -- Miso-Lachs aus dem Ofen
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('ee554656-aa2c-51f0-a493-62cd14ee27d6', h, 'Miso-Lachs aus dem Ofen', 'schnell', 27, 3, true, array['ofen']::text[], '1× Fisch pro Woche ist Ziel – der einfachste Weg. Miso hält ewig im Kühlschrank.', 'Ein Stückchen Lachs ohne Marinade in einem Extra-Eck mitbacken. Reis + Gurke als Beilage.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('1505c221-e1a7-59f6-aa3f-68c1b03d3953', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 0, 'Lachsfilets (mit Haut)', 3, 'à 150 g', false, 'sonstiges'),
    ('37a799eb-adfe-5744-a6ad-ee792d33da9b', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 1, 'Weißes Miso (Shiro)', 3, 'EL', true, 'sonstiges'),
    ('4df87660-a7d7-5ebb-a88f-73404f09ffbd', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 2, 'Mirin', 2, 'EL', true, 'sonstiges'),
    ('d222d940-2468-5c97-af7b-4b1b7e59f353', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 3, 'Sake', 2, 'EL', true, 'sonstiges'),
    ('9ca3f10e-a585-57a3-a37f-95df351229ee', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 4, 'Honig', 1, 'EL', true, 'trocken'),
    ('40241fe3-cd23-56eb-a1b1-3c0f05755aad', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 5, 'Reis', 250, 'g', true, 'trocken'),
    ('b4b1e27f-f7e4-50de-a5b6-85ce377fbf21', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 6, 'Pak Choi oder Spinat', 1, 'Bund', false, 'sonstiges'),
    ('403bec42-b77d-55b1-a5cf-70f9f49a8ca9', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 7, 'Sesam + Lauchzwiebel', null, '', true, 'obst_gemuese')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('b00e9106-a69b-5f24-ac7b-02f8e491dd69', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 0, null, 'Miso + Mirin + Sake + Honig glatt rühren. Lachs einstreichen (idealerweise 30 min ziehen lassen, geht aber auch sofort).', null, false, null, null, null, false, array['1505c221-e1a7-59f6-aa3f-68c1b03d3953', '37a799eb-adfe-5744-a6ad-ee792d33da9b', '4df87660-a7d7-5ebb-a88f-73404f09ffbd', 'd222d940-2468-5c97-af7b-4b1b7e59f353', '9ca3f10e-a585-57a3-a37f-95df351229ee']::uuid[]),
    ('4c87c900-e2f9-5d65-ab42-4027beb00efd', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 1, null, 'Ofen auf 200°C Ober-/Unterhitze vorheizen. Reis kochen.', null, false, null, null, null, false, array['40241fe3-cd23-56eb-a1b1-3c0f05755aad']::uuid[]),
    ('b8a927a5-8a90-56be-ad2a-b6d80f8cd5a2', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 2, null, 'Lachs auf Backpapier, 12 min backen (medium) oder 15 min durchgegart.', 720, false, null, null, null, false, array['1505c221-e1a7-59f6-aa3f-68c1b03d3953']::uuid[]),
    ('2808d1b5-42af-5ece-a289-67d3a3a06cc3', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 3, null, 'Pak Choi halbieren, in Pfanne mit Sesamöl + Sojasauce 4 min dämpfen.', 240, false, null, null, null, false, array['b4b1e27f-f7e4-50de-a5b6-85ce377fbf21', '403bec42-b77d-55b1-a5cf-70f9f49a8ca9']::uuid[]),
    ('c6fec619-9bc0-568f-a0f7-9187a324ddbf', h, 'ee554656-aa2c-51f0-a493-62cd14ee27d6', 4, null, 'Anrichten: Reis, Lachs, Pak Choi, Sesam, Lauchzwiebel.', null, false, null, null, null, false, array['1505c221-e1a7-59f6-aa3f-68c1b03d3953', '40241fe3-cd23-56eb-a1b1-3c0f05755aad', 'b4b1e27f-f7e4-50de-a5b6-85ce377fbf21', '403bec42-b77d-55b1-a5cf-70f9f49a8ca9']::uuid[])
    on conflict (id) do nothing;

  -- Caprese-Quinoa-Bowl
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('fd46fc35-c34e-59e8-a74d-e609667dbc51', h, 'Caprese-Quinoa-Bowl', 'schnell', 20, 3, true, array['topf']::text[], 'Geht auch morgen kalt aus dem Kühlschrank – wird sogar besser.', 'Isst das wahrscheinlich 1:1 mit. Falls nicht: Tomaten + Mozzarella pur, Quinoa extra Schälchen.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('fe243b3f-2b1f-55ab-a9fe-e422110af3f3', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 0, 'Quinoa', 200, 'g', true, 'sonstiges'),
    ('34d45ade-72ac-503b-aa39-fbde62e39b5d', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 1, 'Gemüsebrühe', 400, 'ml', true, 'trocken'),
    ('34f21dd5-fcce-5bf8-ac19-18ae2ced84fa', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 2, 'Cherrytomaten', 300, 'g', false, 'obst_gemuese'),
    ('134a485b-3946-528c-ac53-a3dd37b0b5ef', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 3, 'Mozzarella (Büffel)', 250, 'g', false, 'kuehl'),
    ('566a2f57-c810-527b-a124-d49d163f3627', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 4, 'Basilikum', 1, 'Bund', false, 'obst_gemuese'),
    ('f4645e93-0196-51b6-a806-347f415b4ce0', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 5, 'Olivenöl', 2, 'EL', true, 'trocken'),
    ('2e9caa98-4e6c-5f4f-a623-bb1d4517dee0', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 6, 'Balsamico oder Balsamico-Creme', 2, 'EL', true, 'kuehl'),
    ('f7c544bb-23bf-5baf-a092-06253534de04', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 7, 'Pinienkerne (optional)', null, 'geröstet', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('7bfadc51-4e5c-5514-a5ec-568118bd7aa8', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 0, null, 'Quinoa waschen, in Brühe 15 min mit Deckel köcheln bis alles aufgenommen. Abkühlen.', 900, false, null, null, null, false, array['fe243b3f-2b1f-55ab-a9fe-e422110af3f3', '34d45ade-72ac-503b-aa39-fbde62e39b5d']::uuid[]),
    ('12d86ffe-9437-57b9-afe7-da431bfa41e4', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 1, null, 'Tomaten halbieren, Mozzarella würfeln, Basilikum grob zerrupfen.', null, false, null, null, null, false, array['34f21dd5-fcce-5bf8-ac19-18ae2ced84fa', '134a485b-3946-528c-ac53-a3dd37b0b5ef', '566a2f57-c810-527b-a124-d49d163f3627']::uuid[]),
    ('aff28692-6fa9-53e3-aa08-2d0f3e576eb6', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 2, null, 'Alles in Schüssel, Olivenöl + Balsamico + Salz + Pfeffer, vermischen.', null, false, null, null, null, false, array['f4645e93-0196-51b6-a806-347f415b4ce0', '2e9caa98-4e6c-5f4f-a623-bb1d4517dee0']::uuid[]),
    ('ff3e04bf-7d65-53c9-a443-984a115acfd7', h, 'fd46fc35-c34e-59e8-a74d-e609667dbc51', 3, null, 'Pinienkerne drüber.', null, false, null, null, null, false, array['f7c544bb-23bf-5baf-a092-06253534de04']::uuid[])
    on conflict (id) do nothing;

  -- Hummus-Bowl mit Falafel
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('b030e866-cb64-53c4-a5b0-201864fc1209', h, 'Hummus-Bowl mit Falafel', 'schnell', 20, 3, true, array['pfanne', 'thermomix']::text[], 'Hummus auf Vorrat machen – hält 5 Tage. Tolle Snack-Basis.', 'Falafel pur (sie liebt sie), Gurke + Tomate separat, Pita-Stücke. Hummus zum Tunken, Tahini-Dressing weglassen (zu intensiv).', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('64debf59-2c3c-5466-acca-d6b69e0c7019', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 0, 'Falafel (gekauft oder TK)', 12, 'Stück', false, 'sonstiges'),
    ('0113ce06-2761-5bd9-a462-ab9800211a46', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 1, 'Hummus (gekauft oder selbst)', 250, 'g', false, 'sonstiges'),
    ('f3b5be19-509e-5ab6-a74a-72660d3b76ed', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 2, 'Gurke', 1, 'Stück', false, 'obst_gemuese'),
    ('e3bdee68-ee77-514e-a2bb-ce723bf2ab2f', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 3, 'Tomaten', 2, 'Stück', false, 'obst_gemuese'),
    ('dfe7bc77-fa9b-5d3d-a47b-a07aa00edd4f', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 4, 'Rotkohl', 0.5, 'Stück', false, 'sonstiges'),
    ('26e4cee5-e631-5486-adb9-f84e0c896a8a', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 5, 'Petersilie', 1, 'Bund', false, 'obst_gemuese'),
    ('0763e3d0-0377-59bf-a122-c49e31d4e040', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 6, 'Tahini', 3, 'EL', true, 'sonstiges'),
    ('0ea5da4e-f801-58f3-a8c6-8ce0800b515f', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 7, 'Zitronensaft', 1, 'Zitrone', false, 'obst_gemuese'),
    ('406b8920-37d0-5de7-ad5c-6fdad0ae7d47', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 8, 'Fladenbrot oder Pita', null, '', false, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('791921cc-6879-5d40-a147-d807ef172b46', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 0, null, 'Falafel erwärmen (Pfanne mit Öl 6 min oder Ofen 200°C 10 min).', 360, false, null, null, null, false, array['64debf59-2c3c-5466-acca-d6b69e0c7019']::uuid[]),
    ('1fee71d7-4561-5ef1-af40-2bf7d8af52dd', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 1, null, 'Tahini-Dressing: 3 EL Tahini + Saft 1 Zitrone + 1 Knoblauchzehe + 4 EL Wasser + Salz verquirlen.', null, false, null, null, null, false, array['0763e3d0-0377-59bf-a122-c49e31d4e040', '0ea5da4e-f801-58f3-a8c6-8ce0800b515f']::uuid[]),
    ('992b50d8-5951-5118-a0ba-c2741838dbeb', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 2, null, 'Bowl: Hummus auf Teller streichen, Falafel drauflegen, Gurke (Stifte), Tomate (gewürfelt), Rotkohl (fein gehobelt), Petersilie. Dressing drüber. Pita dazu.', null, false, null, null, null, false, array['64debf59-2c3c-5466-acca-d6b69e0c7019', '0113ce06-2761-5bd9-a462-ab9800211a46', 'f3b5be19-509e-5ab6-a74a-72660d3b76ed', 'e3bdee68-ee77-514e-a2bb-ce723bf2ab2f', 'dfe7bc77-fa9b-5d3d-a47b-a07aa00edd4f', '26e4cee5-e631-5486-adb9-f84e0c896a8a', '406b8920-37d0-5de7-ad5c-6fdad0ae7d47']::uuid[]),
    ('03e698c0-2da8-5702-ab22-2c8a6edee7b9', h, 'b030e866-cb64-53c4-a5b0-201864fc1209', 3, null, 'Eigener Hummus (Thermomix): 1 Dose Kichererbsen + 3 EL Tahini + Saft 1 Zitrone + 2 Knoblauchzehen + 100 ml Aquafaba + Salz', null, true, 60, '', '8', false, array['0113ce06-2761-5bd9-a462-ab9800211a46', '0763e3d0-0377-59bf-a122-c49e31d4e040', '0ea5da4e-f801-58f3-a8c6-8ce0800b515f']::uuid[])
    on conflict (id) do nothing;

  -- Overnight Oats (5-Portionen-Basis)
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', h, 'Overnight Oats (5-Portionen-Basis)', 'fruehstueck', 10, 5, true, array['thermomix']::text[], 'Sonntag abends ist die Standard-Routine. Anna macht das meistens. Hält 5 Tage – danach wird''s pampig.', '1:1-Anteil mit etwas mehr Ahornsirup + Banane in Scheiben oben drauf. Sie liebt''s.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('542259b8-b7fb-5a4a-a98e-1d751cf41f24', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 0, 'Zarte Haferflocken', 300, 'g', true, 'trocken'),
    ('82b4dff3-109a-55e3-ae36-13d0e964f997', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 1, 'Hafermilch oder Vollmilch', 600, 'ml', true, 'kuehl'),
    ('c6a38a71-8d9a-589e-ac9f-cf48f02ce8bd', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 2, 'Naturjoghurt', 400, 'g', false, 'kuehl'),
    ('9453ff3d-de72-5bd6-afe0-f09c7b07c7bd', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 3, 'Chiasamen', 2, 'EL', true, 'trocken'),
    ('d0678777-99af-5d1c-a736-c933227502c0', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 4, 'Ahornsirup', 3, 'EL', true, 'trocken'),
    ('7858badb-dfa6-5837-ab74-5f5c6144245e', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 5, 'Vanille', 1, 'TL', true, 'sonstiges'),
    ('2541fb58-4ba5-5043-ab45-fcba4d2a2454', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 6, 'Prise Salz', null, '', true, 'sonstiges'),
    ('31ade2b1-1032-538f-a54c-8505e6e3b00e', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 7, 'Topping: Obst, Nüsse, Leinsamen', null, 'saisonal', false, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('2f154e63-fbcd-5e97-af67-155480ff73d5', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 0, 'Verrühren', 'Alle Basis-Zutaten in Thermomix', null, true, 15, '', '2', false, '{}'::uuid[]),
    ('bbeab7e3-9fff-5610-a4d5-a7ba190e43ab', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 1, null, 'Auf 5 Weck-Gläser (290 ml) verteilen.', null, false, null, null, null, false, '{}'::uuid[]),
    ('14aef393-2d0f-56e5-a0a7-4f128d250944', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 2, null, 'Über Nacht in den Kühlschrank.', null, false, null, null, null, false, '{}'::uuid[]),
    ('2abbd5a5-922c-5857-a5da-e774d74554f0', h, '60c4edf0-bd9f-543d-a1d3-ccda68a89bc6', 3, null, 'Morgens: Obst (Erdbeeren, Banane, Heidelbeeren, Apfel) + Nüsse drauf.', null, false, null, null, null, false, array['31ade2b1-1032-538f-a54c-8505e6e3b00e']::uuid[])
    on conflict (id) do nothing;

  -- Maki-Rollen einfach
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', h, 'Maki-Rollen einfach', 'schnell', 30, 3, true, array['topf']::text[], 'Wochenend-Projekt, aber immer ein Erlebnis. Mit Valerie zusammen machen – sie darf rollen.', 'Reis + Gurke + Lachs separat als "Sushi-Bowl". Die Rollen sind ihr oft zu fummelig. Reis mit Sojasauce zum Tunken = Hit.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('73ccc98f-0eae-5a10-a321-6aa58eed5a8e', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 0, 'Sushi-Reis', 300, 'g', true, 'trocken'),
    ('3deecdc7-3837-5bd3-a283-7701d6a21689', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 1, 'Reisessig', 2, 'EL', true, 'trocken'),
    ('2e561203-6939-5fff-a494-dabd08e403ee', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 2, 'Zucker', 1, 'EL', true, 'trocken'),
    ('9d3b3664-c684-53be-a0e0-522434986f98', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 3, 'Salz', 1, 'TL', true, 'sonstiges'),
    ('df8d7adf-8ddf-5ab6-a0f3-bb0d58a16630', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 4, 'Nori-Blätter', 4, 'Stück', true, 'sonstiges'),
    ('18222249-7b6f-55f6-a369-aa5b6464b2e1', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 5, 'Gurke', 1, 'Stück', false, 'obst_gemuese'),
    ('b39ec957-c96c-596f-a7d6-b7d5a8a4f79d', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 6, 'Avocado', 1, 'Stück', false, 'obst_gemuese'),
    ('34baf9af-7271-5c71-ae66-0d3fd71d0c2f', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 7, 'Lachs (Sushi-Qualität) oder Räucherlachs', 200, 'g', false, 'sonstiges'),
    ('defeae81-e6ae-50a8-a310-4a1bd5ad1c51', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 8, 'Sojasauce, Wasabi, eingelegter Ingwer', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('99ce466c-836d-505c-abd5-e79f489d814a', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 0, null, 'Reis gründlich waschen (bis Wasser klar). In Topf mit gleicher Menge Wasser. Aufkochen, dann 15 min auf kleinster Stufe mit Deckel. 10 min ziehen lassen.', 900, false, null, null, null, false, array['73ccc98f-0eae-5a10-a321-6aa58eed5a8e', '3deecdc7-3837-5bd3-a283-7701d6a21689']::uuid[]),
    ('e13b31f4-639f-5cbf-a94e-b91d7dcc46a4', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 1, null, 'Sushi-Essig (Reisessig + Zucker + Salz) unter den warmen Reis mischen, abkühlen lassen.', null, false, null, null, null, false, array['73ccc98f-0eae-5a10-a321-6aa58eed5a8e', '3deecdc7-3837-5bd3-a283-7701d6a21689', '2e561203-6939-5fff-a494-dabd08e403ee', '9d3b3664-c684-53be-a0e0-522434986f98']::uuid[]),
    ('f93fc784-730f-5906-ae0c-edd337a274fa', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 2, null, 'Nori-Blatt auf Rollmatte, glänzende Seite unten. Reis dünn verteilen, 2 cm am oberen Rand freilassen.', null, false, null, null, null, false, array['73ccc98f-0eae-5a10-a321-6aa58eed5a8e', '3deecdc7-3837-5bd3-a283-7701d6a21689', 'df8d7adf-8ddf-5ab6-a0f3-bb0d58a16630']::uuid[]),
    ('a7142dd3-f332-531b-a247-337115e24425', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 3, null, 'Füllung (Gurke + Avocado + Lachs) als Streifen auf das untere Drittel legen.', null, false, null, null, null, false, array['18222249-7b6f-55f6-a369-aa5b6464b2e1', 'b39ec957-c96c-596f-a7d6-b7d5a8a4f79d', '34baf9af-7271-5c71-ae66-0d3fd71d0c2f']::uuid[]),
    ('9a5827cd-7ed8-5134-a20d-51952ac05ac1', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 4, null, 'Von unten mit Rollmatte fest einrollen, oberen Rand leicht anfeuchten zum Verschließen.', null, false, null, null, null, false, '{}'::uuid[]),
    ('2df4233c-5e0c-59e5-afa3-e4f9acd6f680', h, 'fd1509a7-e91e-5e8c-ade7-2fa01b8cfde2', 5, null, 'Mit scharfem Messer in 8 Stücke schneiden (Messer zwischendurch abwischen).', null, false, null, null, null, false, '{}'::uuid[])
    on conflict (id) do nothing;

  -- Rotes Thai Curry
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', h, 'Rotes Thai Curry', 'mealprep', 40, 4, true, array['wok', 'pfanne']::text[], 'Gelbes/grünes Curry mit gleicher Methode, andere Paste. Currypasten halten monatelang.', 'Vor der Currypaste ein kleines Stück Hähnchen in normaler Kokosmilch separat garen. Reis + Hähnchen + Gurke/Paprika-Rohkost.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('822c70bb-b7df-5246-a890-bc69d9bcc4a0', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 0, 'Rote Currypaste (Mae Ploy)', 3, 'EL', true, 'trocken'),
    ('81e32075-98d9-5343-a64f-2100ed9150e6', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 1, 'Kokosmilch', 400, 'ml', true, 'trocken'),
    ('117566c0-95fd-5a2a-a414-65a196240d27', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 2, 'Hühnerbrühe', 200, 'ml', true, 'trocken'),
    ('64aa995a-78fd-5ce9-a731-87b524812029', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 3, 'Hähnchenbrust oder Tofu', 500, 'g', false, 'kuehl'),
    ('eea6a87f-eb2e-5ea8-a362-9b10b569560c', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 4, 'Paprika', 1, 'Stück', false, 'obst_gemuese'),
    ('42e6d7b9-5384-5772-a97c-ef66878c756f', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 5, 'Bambussprossen (Dose)', 100, 'g', true, 'trocken'),
    ('8e37b9c3-18f8-59a8-ac63-f7f7c57eec78', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 6, 'Zucchini', 1, 'Stück', false, 'sonstiges'),
    ('ed9139cf-59a9-5ba9-a3ec-f101ba50711c', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 7, 'Fischsauce', 1, 'EL', true, 'trocken'),
    ('9f1ac44a-55c0-595f-ad83-e0974b95767d', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 8, 'Palmzucker oder brauner Zucker', 1, 'EL', true, 'trocken'),
    ('334c2c8b-c0ab-5e2c-a498-87298d852f07', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 9, 'Limette', 1, 'Stück', false, 'obst_gemuese'),
    ('87e26364-c8cf-5156-af67-6cb078747536', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 10, 'Thai-Basilikum', null, 'nach Geschmack', false, 'obst_gemuese'),
    ('a731009c-fce7-5e0e-a31a-129a25fb8142', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 11, 'Reis', null, 'als Beilage', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('b26a9cfb-fc88-5119-a246-6dac453269e4', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 0, null, 'Reis kochen.', null, false, null, null, null, false, array['a731009c-fce7-5e0e-a31a-129a25fb8142']::uuid[]),
    ('a896059f-3036-5c81-a32b-fb43054a38ba', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 1, null, '1 EL Kokosmilch (dicke Schicht oben!) in Wok, Currypaste dazu, 3 min rösten bis intensiv duftend (wichtig!).', 180, false, null, null, null, false, array['822c70bb-b7df-5246-a890-bc69d9bcc4a0', '81e32075-98d9-5343-a64f-2100ed9150e6']::uuid[]),
    ('888f9130-728b-5394-a862-1eec9980af54', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 2, null, 'Rest Kokosmilch + Brühe dazu, aufkochen.', null, false, null, null, null, false, array['81e32075-98d9-5343-a64f-2100ed9150e6', '117566c0-95fd-5a2a-a414-65a196240d27']::uuid[]),
    ('a74cd662-544a-55f7-a783-515e8a78beab', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 3, null, 'Hähnchen/Tofu rein, 8 min ziehen lassen.', 480, false, null, null, null, false, array['64aa995a-78fd-5ce9-a731-87b524812029']::uuid[]),
    ('5f3e314d-2911-5b95-a110-4cb226c04229', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 4, null, 'Paprika + Bambus + Zucchini, 5 min köcheln.', 300, false, null, null, null, false, array['eea6a87f-eb2e-5ea8-a362-9b10b569560c', '42e6d7b9-5384-5772-a97c-ef66878c756f', '8e37b9c3-18f8-59a8-ac63-f7f7c57eec78']::uuid[]),
    ('4efcd5d4-4fd7-5050-a35f-2d390b740d12', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 5, null, 'Fischsauce + Palmzucker + Limette abschmecken.', null, false, null, null, null, false, array['ed9139cf-59a9-5ba9-a3ec-f101ba50711c', '9f1ac44a-55c0-595f-ad83-e0974b95767d', '334c2c8b-c0ab-5e2c-a498-87298d852f07']::uuid[]),
    ('d569f376-3d49-5c98-a193-5329f258d798', h, '6ac66cd6-58a7-532e-a4ad-cb8314fcafd9', 6, null, 'Basilikum drüber, mit Reis servieren.', null, false, null, null, null, false, array['87e26364-c8cf-5156-af67-6cb078747536', 'a731009c-fce7-5e0e-a31a-129a25fb8142']::uuid[])
    on conflict (id) do nothing;

  -- Hähnchen-Shawarma-Bowl
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('18ebefcc-11d9-5025-aa18-7f13b702253e', h, 'Hähnchen-Shawarma-Bowl', 'mealprep', 45, 3, true, array['plancha', 'pfanne']::text[], 'Marinade 4-fach anrühren – Rest in den Freezer (mit Hähnchen eingefroren → Direkt-Gefrier-zum-Plancha-Rezept).', 'Ein Stück Hähnchen vor der Marinade abzweigen, kurz in Butter braten. Reis + Hähnchen pur + Gurke + Tomate.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('cbf423f1-51bb-5542-a9b4-0e569c8e4e41', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 0, 'Hähnchenschenkel ohne Knochen', 500, 'g', false, 'kuehl'),
    ('effe39e9-5994-51b7-a5c9-06fb47ec9f0b', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 1, 'Basmati-Reis', 250, 'g', true, 'trocken'),
    ('66b84321-d023-58e5-a310-b407011316e8', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 2, 'Olivenöl', 3, 'EL', true, 'trocken'),
    ('5bcae892-590b-520b-a462-0563795f4af2', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 3, 'Kreuzkümmel, Koriander, Paprika edelsüß, Zimt, Kurkuma', null, 'je 1-2 TL', true, 'obst_gemuese'),
    ('d925a11f-d13f-56de-acea-d7b7136227a9', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 4, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('d07b0832-36db-5e1a-a2f4-23a35ee6b27f', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 5, 'Zitrone', 1, 'Stück', false, 'obst_gemuese'),
    ('3222f3e5-3b45-5b1e-a6fa-50511e3510f4', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 6, 'Salatherzen', 2, 'Stück', false, 'obst_gemuese'),
    ('f2578da4-f710-5ef9-a26f-611bed0d6424', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 7, 'Tomaten', 2, 'Stück', false, 'obst_gemuese'),
    ('bf96229d-8265-5f24-a29e-3fb53b5d5458', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 8, 'Gurke', 1, 'Stück', false, 'obst_gemuese'),
    ('f435d0fd-ed8b-5be0-a14a-b69e68051416', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 9, 'Rote Zwiebel', 0.5, 'Stück', false, 'obst_gemuese'),
    ('b8aea9ff-26c7-5913-a758-f41aee0e41a9', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 10, 'Petersilie, Tahini, Oliven', null, '', true, 'obst_gemuese')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('7954d51c-561f-58fd-aef5-615d664db873', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 0, null, 'Marinade: Olivenöl + Gewürze + Knoblauch (gepresst) + Zitronensaft + Salz, Pfeffer mischen. Hähnchen drin wenden, mind. 20 min (besser 2h) ziehen lassen.', null, false, null, null, null, false, array['cbf423f1-51bb-5542-a9b4-0e569c8e4e41', '66b84321-d023-58e5-a310-b407011316e8', 'd925a11f-d13f-56de-acea-d7b7136227a9', 'd07b0832-36db-5e1a-a2f4-23a35ee6b27f', 'b8aea9ff-26c7-5913-a758-f41aee0e41a9']::uuid[]),
    ('0a0e55ad-8d8e-57fd-a52a-8cedd6eddbee', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 1, null, 'Reis kochen.', null, false, null, null, null, false, array['effe39e9-5994-51b7-a5c9-06fb47ec9f0b']::uuid[]),
    ('f6e32d7b-e704-516c-aced-9cf5075cbe63', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 2, null, 'Plancha oder Pfanne heiß. Hähnchen in einer Lage scharf anbraten, je 4 min pro Seite, bis gebräunt und durch. Rausnehmen, 3 min ruhen lassen, in Streifen schneiden.', 240, false, null, null, null, false, array['cbf423f1-51bb-5542-a9b4-0e569c8e4e41']::uuid[]),
    ('23e0b042-647e-5429-a331-d3bd2a22f112', h, '18ebefcc-11d9-5025-aa18-7f13b702253e', 3, null, 'Bowl bauen: Reis, Hähnchen, Salat, Tomate, Gurke, Zwiebel, Petersilie. Tahini drüber.', null, false, null, null, null, false, array['cbf423f1-51bb-5542-a9b4-0e569c8e4e41', 'effe39e9-5994-51b7-a5c9-06fb47ec9f0b', '3222f3e5-3b45-5b1e-a6fa-50511e3510f4', 'f2578da4-f710-5ef9-a26f-611bed0d6424', 'bf96229d-8265-5f24-a29e-3fb53b5d5458', 'f435d0fd-ed8b-5be0-a14a-b69e68051416', 'b8aea9ff-26c7-5913-a758-f41aee0e41a9']::uuid[])
    on conflict (id) do nothing;

  -- Gemüse-Lasagne
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('a37bd5a6-9d08-5f0c-a140-e6e322309259', h, 'Gemüse-Lasagne', 'mealprep', 55, 4, true, array['ofen']::text[], 'Variante mit Bolognese-Cubes aus dem Freezer: halbe Bolognese / halbe Gemüse-Schicht. Dauert 5 min weniger Vorbereitung.', 'Sie liebt Lasagne – gleiche Portion, kleiner geschnitten. Falls zu würzig: weniger Oregano in ihrer Ecke.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('e0e5f9e6-f3f9-5475-abfb-88168a9173a9', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 0, 'Lasagneplatten (ohne Vorkochen)', 10, 'Stück', true, 'sonstiges'),
    ('9e28584d-bd11-5727-ab3e-586e69c72731', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 1, 'Zucchini', 1, 'Stück', false, 'sonstiges'),
    ('c1784809-2a52-5030-ad13-4be6a047fbbe', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 2, 'Aubergine', 1, 'Stück', false, 'obst_gemuese'),
    ('7d644342-4d58-5de2-a4f5-6bdb155cee05', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 3, 'Paprika', 1, 'Stück', false, 'obst_gemuese'),
    ('ebea1735-7c9e-51ce-a6ce-cd05f896dd70', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 4, 'Spinat (frisch oder TK)', 200, 'g', false, 'sonstiges'),
    ('cfacfb4e-d4fc-5b74-a0f1-af1168ba994d', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 5, 'Dosentomaten', 400, 'g', true, 'trocken'),
    ('672139e3-5d00-5fdd-a9e6-d39773d5fe80', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 6, 'Ricotta', 250, 'g', false, 'kuehl'),
    ('a74072a8-1832-5c13-a92a-98b7ee5638e9', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 7, 'Mozzarella', 200, 'g', false, 'kuehl'),
    ('881f43f5-ff65-510b-aa34-c7af70e5bedd', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 8, 'Parmesan', 50, 'g', true, 'kuehl'),
    ('29398317-ecfc-5344-a699-7b490748a005', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 9, 'Zwiebel + Knoblauch + Olivenöl + Oregano', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('979d86ef-453e-5d91-ae70-c162117416b7', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 0, null, 'Ofen auf 200°C vorheizen.', null, false, null, null, null, false, '{}'::uuid[]),
    ('6e45a928-a1c6-51bd-a92d-940cb98df8a6', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 1, null, 'Zwiebel + Knoblauch anbraten, Dosentomaten + Oregano dazu, 10 min köcheln → Tomatensauce.', 600, false, null, null, null, false, array['cfacfb4e-d4fc-5b74-a0f1-af1168ba994d', '29398317-ecfc-5344-a699-7b490748a005']::uuid[]),
    ('ad8b5f75-30d6-5cdf-aed5-f2bf249be4e7', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 2, null, 'Zucchini + Aubergine in Pfanne (oder Plancha) kurz anbraten.', null, false, null, null, null, false, array['9e28584d-bd11-5727-ab3e-586e69c72731', 'c1784809-2a52-5030-ad13-4be6a047fbbe']::uuid[]),
    ('b97c703d-edd2-54b8-a874-2fe605529ced', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 3, null, 'Spinat kurz andünsten, ausdrücken. Mit Ricotta + Prise Muskat mischen.', null, false, null, null, null, false, array['ebea1735-7c9e-51ce-a6ce-cd05f896dd70', '672139e3-5d00-5fdd-a9e6-d39773d5fe80']::uuid[]),
    ('0db45d6c-0fb9-5afe-abd0-f3f6c4643fd5', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 4, null, 'Schichten: Sauce → Platten → Gemüse → Ricotta-Spinat → Mozzarella → wiederholen. Oberste Schicht: Sauce + Parmesan.', null, false, null, null, null, false, array['e0e5f9e6-f3f9-5475-abfb-88168a9173a9', 'ebea1735-7c9e-51ce-a6ce-cd05f896dd70', '672139e3-5d00-5fdd-a9e6-d39773d5fe80', 'a74072a8-1832-5c13-a92a-98b7ee5638e9', '881f43f5-ff65-510b-aa34-c7af70e5bedd']::uuid[]),
    ('4eb30783-1d5d-5d02-a3dc-38f3a76ad3dc', h, 'a37bd5a6-9d08-5f0c-a140-e6e322309259', 5, null, '35 min backen bis gebräunt. 5 min ruhen.', 2100, false, null, null, null, false, '{}'::uuid[])
    on conflict (id) do nothing;

  -- Chicken Katsu mit Tonkatsu-Sauce
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('1723f5dd-e8ad-5963-a1d9-ada1c75125b8', h, 'Chicken Katsu mit Tonkatsu-Sauce', 'schnell', 30, 3, true, array['pfanne']::text[], 'Katsu-Sandwich (Sando) am nächsten Tag: Toastbrot + Kohl + Katsu + Sauce = Hit.', 'Gleiche Portion – sie liebt Panade. Sauce separat (sie taucht manchmal rein). Reis pur, Gurke/Karotte dazu.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('76cff20c-1061-5f8e-adfd-c7e70a24f42d', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 0, 'Hähnchenbrustfilets', 3, 'Stück', false, 'kuehl'),
    ('62e0115b-1913-5554-ad83-54f20afea332', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 1, 'Panko (japanisches Brotsemmelbrot)', 100, 'g', true, 'trocken'),
    ('8f06a0b6-317d-5bf2-a4ce-84a25495490c', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 2, 'Eier', 2, 'Stück', true, 'kuehl'),
    ('6ad2ff7a-41f6-5d95-a751-7631fed6251f', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 3, 'Mehl', 4, 'EL', true, 'trocken'),
    ('e4cf3229-383a-5b6f-accc-3a6b19928778', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 4, 'Sonnenblumenöl', null, 'zum Braten', true, 'trocken'),
    ('0e0c9215-5c31-5300-aa1d-718d0279cf7c', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 5, 'Reis', 250, 'g', true, 'trocken'),
    ('7c4c6419-b48f-572b-a893-ec4ccb70d779', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 6, 'Weißkohl', 0.5, 'Stück', false, 'sonstiges'),
    ('6506a687-ad80-5bda-a1e1-684d8f866b0e', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 7, 'Ketchup, Worcestersauce, Sojasauce, Zucker, Senf (für Sauce)', null, '', true, 'trocken'),
    ('0213324a-408f-5183-ac02-7add50a3a8aa', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 8, 'Zitrone', 1, 'Stück', false, 'obst_gemuese')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('57c5fc47-9675-5410-a84f-15780930ccca', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 0, null, 'Reis kochen.', null, false, null, null, null, false, array['0e0c9215-5c31-5300-aa1d-718d0279cf7c']::uuid[]),
    ('90353408-3275-5f0f-a07d-61eae3680f41', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 1, null, 'Tonkatsu-Sauce: 4 EL Ketchup + 2 EL Worcestersauce + 2 EL Sojasauce + 1 EL Zucker + 1 TL Senf verrühren.', null, false, null, null, null, false, array['6506a687-ad80-5bda-a1e1-684d8f866b0e']::uuid[]),
    ('af67a7d4-eeed-5336-a729-d136700aa2df', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 2, null, 'Hähnchen auf 1,5 cm dünn klopfen. Salzen.', null, false, null, null, null, false, array['76cff20c-1061-5f8e-adfd-c7e70a24f42d']::uuid[]),
    ('c3aa93d1-cc88-57d9-af3d-c2849b91f26c', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 3, null, 'Panade: Mehl → Ei → Panko. Gut andrücken.', null, false, null, null, null, false, array['62e0115b-1913-5554-ad83-54f20afea332', '8f06a0b6-317d-5bf2-a4ce-84a25495490c', '6ad2ff7a-41f6-5d95-a751-7631fed6251f']::uuid[]),
    ('c1068666-ba5f-5c86-a4e5-954aae951b92', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 4, null, 'Öl in Pfanne (2 cm hoch), auf 170°C. Hähnchen 4 min pro Seite goldbraun.', 240, false, null, null, null, false, array['76cff20c-1061-5f8e-adfd-c7e70a24f42d']::uuid[]),
    ('41cca470-cbc2-5df3-a8c8-978bb64ef2f3', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 5, null, 'Auf Küchenpapier abtropfen, in Streifen schneiden.', null, false, null, null, null, false, '{}'::uuid[]),
    ('01876b90-bb64-56d6-a814-ebb1421ab280', h, '1723f5dd-e8ad-5963-a1d9-ada1c75125b8', 6, null, 'Servieren: Reis, Katsu, Kohl (fein gehobelt), Sauce drüber, Zitronenspalte.', null, false, null, null, null, false, array['0e0c9215-5c31-5300-aa1d-718d0279cf7c', '7c4c6419-b48f-572b-a893-ec4ccb70d779', '6506a687-ad80-5bda-a1e1-684d8f866b0e', '0213324a-408f-5183-ac02-7add50a3a8aa']::uuid[])
    on conflict (id) do nothing;

  -- Chana Masala
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('a03aeda8-82de-5cf3-aa29-ccadea7c01f6', h, 'Chana Masala', 'mealprep', 35, 4, true, array['topf']::text[], 'Mealprep-Held. Hält 4 Tage, friert perfekt ein als Cube.', 'Kichererbsen + milde Tomatensauce vor dem Chili abnehmen, etwas Joghurt drunter mischen. Reis dazu.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('38b58417-5e62-5545-a6d8-6a23bed56f82', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 0, 'Kichererbsen (Dose)', 2, 'Dosen', true, 'trocken'),
    ('f35540fe-3a88-5362-ad78-b836aff8f952', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 1, 'Zwiebeln', 2, 'Stück', true, 'obst_gemuese'),
    ('227b4082-64ec-580d-a373-8e7ded02962c', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 2, 'Knoblauch', 4, 'Zehen', true, 'obst_gemuese'),
    ('d1b70c12-8bcb-52d1-afaa-bfbc48c082ae', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 3, 'Ingwer', 3, 'cm', true, 'obst_gemuese'),
    ('dfa4a967-301f-5b0d-a439-58f907be0f56', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 4, 'Dosentomaten', 400, 'g', true, 'trocken'),
    ('3529eac8-28d9-50c5-a14e-f05e1342ca23', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 5, 'Garam Masala, Kreuzkümmel, Koriander, Kurkuma, Chili, Amchur (opt.)', null, '', true, 'obst_gemuese'),
    ('61c2f06e-c2c6-5a51-a147-7a78c57d5786', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 6, 'Wasser', 200, 'ml', true, 'sonstiges'),
    ('9b829adc-cad2-51b6-aea5-0d8ecc76ed3a', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 7, 'Zitronensaft', 1, 'EL', false, 'obst_gemuese'),
    ('27b0530c-594f-58f5-acda-1e550911a5bb', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 8, 'Frischer Koriander', 1, 'Bund', false, 'obst_gemuese'),
    ('dfdc355c-9fbe-5df5-ad4f-8c89c2e63638', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 9, 'Basmati-Reis oder Naan', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('2f4a2997-1e09-5224-ae92-568b1f8c4809', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 0, null, 'Reis kochen / Naan vorbereiten.', null, false, null, null, null, false, array['dfdc355c-9fbe-5df5-ad4f-8c89c2e63638']::uuid[]),
    ('5deb3270-4d39-54b0-ac1b-f2caefd6ab22', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 1, null, 'Öl in Topf. Zwiebeln 8 min goldbraun braten.', 480, false, null, null, null, false, array['f35540fe-3a88-5362-ad78-b836aff8f952']::uuid[]),
    ('9481d5b3-53ff-548a-acca-d2234c51dfb7', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 2, null, 'Knoblauch + Ingwer (gerieben) dazu, 2 min.', 120, false, null, null, null, false, array['227b4082-64ec-580d-a373-8e7ded02962c', 'd1b70c12-8bcb-52d1-afaa-bfbc48c082ae']::uuid[]),
    ('86d9c377-8af6-5ada-afd4-1ee0d7d222a9', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 3, null, 'Alle Gewürze (außer Amchur) rein, 30 Sek rösten.', null, false, null, null, null, false, array['3529eac8-28d9-50c5-a14e-f05e1342ca23']::uuid[]),
    ('f187d802-5cec-5770-acf2-fd64bfdf1eec', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 4, null, 'Dosentomaten dazu, 5 min einkochen lassen bis dick.', 300, false, null, null, null, false, array['dfa4a967-301f-5b0d-a439-58f907be0f56']::uuid[]),
    ('881a0a23-881b-5d34-a405-57f7a2d47649', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 5, null, 'Kichererbsen + Wasser + Amchur, 15 min simmern. Einige Kichererbsen zerdrücken (macht Sauce dicker).', 900, false, null, null, null, false, array['38b58417-5e62-5545-a6d8-6a23bed56f82', '3529eac8-28d9-50c5-a14e-f05e1342ca23']::uuid[]),
    ('1017c03d-61f1-5149-a52b-59716bbcd6b0', h, 'a03aeda8-82de-5cf3-aa29-ccadea7c01f6', 6, null, 'Zitrone + Salz. Koriander drüber.', null, false, null, null, null, false, array['3529eac8-28d9-50c5-a14e-f05e1342ca23', '9b829adc-cad2-51b6-aea5-0d8ecc76ed3a', '27b0530c-594f-58f5-acda-1e550911a5bb']::uuid[])
    on conflict (id) do nothing;

  -- Pad Thai
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('b7722982-8d0f-5f2f-aaf9-c921c59c0774', h, 'Pad Thai', 'schnell', 30, 3, true, array['wok']::text[], 'Tamarindenpaste ist der Game Changer – im Asialaden. Ketchup-Notfallvariante ist ok, aber nicht authentisch.', 'Portion Nudeln + Ei + Garnele vor Fischsauce abnehmen. Sojasauce stattdessen. Erdnüsse drauf.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('284b5388-dd90-546a-ac58-dccba549ba12', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 0, 'Reisnudeln (flach, breit)', 300, 'g', true, 'trocken'),
    ('b986b1ed-2183-54ac-af9a-60178b6f6fb8', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 1, 'Garnelen oder Hähnchen oder Tofu', 300, 'g', false, 'kuehl'),
    ('57a9e700-638d-541a-a4aa-91e30a343265', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 2, 'Eier', 2, 'Stück', true, 'kuehl'),
    ('7a0eb8f1-560f-5755-aed6-b883ac6f5bb7', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 3, 'Lauchzwiebeln', 3, 'Stück', false, 'obst_gemuese'),
    ('7a68221c-32f6-58f0-a63b-8c3dd33daaa7', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 4, 'Sojasprossen', 100, 'g', false, 'sonstiges'),
    ('8b467660-f353-5600-a8c9-76413ef3c727', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 5, 'Erdnüsse (gehackt)', 1, 'Handvoll', true, 'trocken'),
    ('6a0322ab-ee64-51f4-ae96-b749674aaf94', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 6, 'Limette', 1, 'Stück', false, 'obst_gemuese'),
    ('c6158116-5fdb-52dc-a9d4-2e5cbfad7602', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 7, 'Koriander', 0.5, 'Bund', false, 'obst_gemuese'),
    ('3d440883-4176-5f5e-a094-cfb88112eb79', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 8, 'Tamarindenpaste', 3, 'EL', true, 'trocken'),
    ('60603af7-9cfc-5cac-aea3-184d8526e633', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 9, 'Fischsauce', 3, 'EL', true, 'trocken'),
    ('d235f318-3460-5547-a838-69d82ef40350', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 10, 'Palmzucker + Sojasauce', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('f0641cc6-9795-5e3f-a786-d6a02492d7cd', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 0, null, 'Reisnudeln 8 min in heißem Wasser einweichen, abgießen.', 480, false, null, null, null, false, array['284b5388-dd90-546a-ac58-dccba549ba12']::uuid[]),
    ('32c50d72-9e14-576c-a7a3-9a0fda9268ee', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 1, null, 'Sauce: Tamarindenpaste + Fischsauce + Palmzucker (3 EL) + Sojasauce (1 EL) verrühren.', null, false, null, null, null, false, array['3d440883-4176-5f5e-a094-cfb88112eb79', '60603af7-9cfc-5cac-aea3-184d8526e633', 'd235f318-3460-5547-a838-69d82ef40350']::uuid[]),
    ('a15d5877-d5d5-5841-a420-b2e6aecfb336', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 2, null, 'Wok sehr heiß, 2 EL Öl. Garnelen/Hähnchen/Tofu scharf anbraten, rausnehmen.', null, false, null, null, null, false, array['b986b1ed-2183-54ac-af9a-60178b6f6fb8']::uuid[]),
    ('2e5a362a-5b15-5858-aa55-0da82da4dd88', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 3, null, 'Etwas Öl dazu, Eier in der Mitte aufschlagen, verquirlen und stocken lassen.', null, false, null, null, null, false, array['57a9e700-638d-541a-a4aa-91e30a343265']::uuid[]),
    ('322f8e6e-f8e2-5a9d-ac0b-6f9b54969098', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 4, null, 'Nudeln rein, Sauce drüber, alles schwenken 2 min.', 120, false, null, null, null, false, array['284b5388-dd90-546a-ac58-dccba549ba12', '60603af7-9cfc-5cac-aea3-184d8526e633', 'd235f318-3460-5547-a838-69d82ef40350']::uuid[]),
    ('d611b2ef-6614-517a-a899-9aa4a69fd260', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 5, null, 'Garnelen + Lauchzwiebel + Sprossen zurück dazu, 1 min durchschwenken.', 60, false, null, null, null, false, array['b986b1ed-2183-54ac-af9a-60178b6f6fb8', '7a0eb8f1-560f-5755-aed6-b883ac6f5bb7', '7a68221c-32f6-58f0-a63b-8c3dd33daaa7']::uuid[]),
    ('1ed561eb-43e2-5bac-afe2-cb031c660735', h, 'b7722982-8d0f-5f2f-aaf9-c921c59c0774', 6, null, 'Mit Erdnüssen, Limette, Koriander servieren.', null, false, null, null, null, false, array['8b467660-f353-5600-a8c9-76413ef3c727', '6a0322ab-ee64-51f4-ae96-b749674aaf94', 'c6158116-5fdb-52dc-a9d4-2e5cbfad7602']::uuid[])
    on conflict (id) do nothing;

  -- Tom Kha Gai
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', h, 'Tom Kha Gai', 'schnell', 35, 4, true, array['topf']::text[], 'Galgant und Kaffir-Blätter im Asialaden besorgen und einfrieren (halten ewig). Unterschied zu "Huhn-Kokos-Suppe".', 'Hähnchenstücke + Pilze mit etwas Brühe vor Chili und Fischsauce abnehmen. Reis dazu.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('4418843f-e1d1-5161-a241-8135a8f3671a', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 0, 'Kokosmilch', 400, 'ml', true, 'trocken'),
    ('c2d27676-963c-5c51-ad7f-8b5c0cbb0fec', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 1, 'Hühnerbrühe', 500, 'ml', true, 'trocken'),
    ('c87c4ccb-e835-56cb-a376-5bfc784f0973', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 2, 'Hähnchenbrust', 300, 'g', false, 'kuehl'),
    ('4a813eab-7ae9-54a8-a877-acadc02438d6', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 3, 'Pilze (Champignons oder Shiitake)', 200, 'g', false, 'sonstiges'),
    ('c1478b8e-3681-56ae-abeb-302ef6b2bd4d', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 4, 'Zitronengras', 3, 'Stangen', true, 'obst_gemuese'),
    ('84892b78-5df1-5a77-a450-c19e9b1c14a4', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 5, 'Galgant oder Ingwer', 5, 'Scheiben', true, 'obst_gemuese'),
    ('3c28c04c-cf3c-532c-aa10-3c1260f85a31', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 6, 'Kaffir-Limettenblätter', 5, 'Stück', true, 'obst_gemuese'),
    ('84ba13cc-199f-5465-a8a5-e4ebb53bd3ea', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 7, 'Fischsauce', 2, 'EL', true, 'trocken'),
    ('12b4feae-aae8-5d6e-a106-a935625d88c8', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 8, 'Zucker', 1, 'EL', true, 'trocken'),
    ('b62072fd-8ebe-5124-ae5e-1390ccf3a6ab', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 9, 'Vogelaugen-Chilis', 1, 'Stück', true, 'obst_gemuese'),
    ('833aa6b8-eaca-5cff-ae46-8e28785647be', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 10, 'Limetten', 2, 'Stück', false, 'obst_gemuese'),
    ('4851500e-644c-525b-aed2-afadd37fd37d', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 11, 'Koriander + Reis', null, 'optional', false, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('5631ea7a-adb3-5316-a0d0-0edb5bf492d6', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 0, null, 'Brühe + Kokosmilch + Zitronengras (angedrückt, in 5 cm Stücken) + Galgant + Limettenblätter aufkochen, 10 min ziehen lassen.', 600, false, null, null, null, false, array['4418843f-e1d1-5161-a241-8135a8f3671a', 'c2d27676-963c-5c51-ad7f-8b5c0cbb0fec', 'c1478b8e-3681-56ae-abeb-302ef6b2bd4d', '84892b78-5df1-5a77-a450-c19e9b1c14a4', '3c28c04c-cf3c-532c-aa10-3c1260f85a31', '833aa6b8-eaca-5cff-ae46-8e28785647be']::uuid[]),
    ('27b1ba74-8cb1-5127-af98-c54b8bae1e86', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 1, null, 'Pilze + Hähnchen (in dünnen Scheiben) rein, 8 min leicht köcheln.', 480, false, null, null, null, false, array['c87c4ccb-e835-56cb-a376-5bfc784f0973', '4a813eab-7ae9-54a8-a877-acadc02438d6']::uuid[]),
    ('69a7d187-28d8-5796-aed7-71697fe7b747', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 2, null, 'Fischsauce + Zucker + Chili + Limettensaft. Abschmecken – sauer-salzig-süß balanciert.', null, false, null, null, null, false, array['84ba13cc-199f-5465-a8a5-e4ebb53bd3ea', '12b4feae-aae8-5d6e-a106-a935625d88c8', 'b62072fd-8ebe-5124-ae5e-1390ccf3a6ab', '833aa6b8-eaca-5cff-ae46-8e28785647be']::uuid[]),
    ('d472fa96-b517-588d-ad9c-371c385f0662', h, '9e4995be-8c10-55dc-ad57-14b3ffd9c2ba', 3, null, 'Koriander drüber. Zitronengras + Galgant beim Essen rausnehmen (nicht essen).', null, false, null, null, null, false, array['c1478b8e-3681-56ae-abeb-302ef6b2bd4d', '84892b78-5df1-5a77-a450-c19e9b1c14a4', '4851500e-644c-525b-aed2-afadd37fd37d']::uuid[])
    on conflict (id) do nothing;

  -- Mapo Tofu
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('48a52e34-a191-5dda-aaff-ccdff8a4fe1d', h, 'Mapo Tofu', 'schnell', 25, 3, true, array['wok', 'pfanne']::text[], 'Doubanjiang (Pixian-Marke ist top) im Asialaden – macht den Unterschied. Ohne wird''s "nur scharfer Tofu".', 'Tofu + Reis pur – ohne Sauce. Optional etwas Hack mit mildem Sojasauce-Wasser. Sichuanpfeffer nicht für sie.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('63b66605-545f-5e14-a8ef-3444b75d1908', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 0, 'Seidentofu', 500, 'g', false, 'sonstiges'),
    ('61b713f3-7542-57b0-a0e4-b3cc92f4027e', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 1, 'Rinderhack oder Schweinehack', 250, 'g', false, 'kuehl'),
    ('22583506-fda1-5641-aac8-f81c8bf5569d', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 2, 'Doubanjiang (Sichuan-Bohnenpaste)', 2, 'EL', true, 'trocken'),
    ('f573ba60-1a38-581e-af50-a6cc7d82b411', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 3, 'Douchi (fermentierte schwarze Bohnen, optional)', 1, 'EL', true, 'sonstiges'),
    ('484a73e3-c7f0-5be5-a9a0-9a3dbde3714f', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 4, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('9c97bd3f-3333-5007-ac27-e341563330be', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 5, 'Ingwer', 2, 'cm', true, 'obst_gemuese'),
    ('cce06324-9801-511c-aca1-ae8638e17210', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 6, 'Lauchzwiebeln', 2, 'Stück', false, 'obst_gemuese'),
    ('563cdfe5-f880-58df-a58a-c834c9a0be80', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 7, 'Hühnerbrühe', 300, 'ml', true, 'trocken'),
    ('4d1206af-481c-51d5-a394-e3556b72cd50', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 8, 'Sojasauce', 1, 'EL', true, 'trocken'),
    ('4a6112c9-4d53-5467-ab0c-ca5e0a049209', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 9, 'Zucker', 1, 'TL', true, 'trocken'),
    ('a329f178-d9a8-57b2-ab3d-b94fdf65ccea', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 10, 'Sichuanpfeffer', 1, 'TL', true, 'sonstiges'),
    ('95ac2678-7cff-55dc-a18a-ccd277d1670a', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 11, 'Speisestärke', 1, 'EL', true, 'sonstiges'),
    ('8241654d-8cb6-5f23-a1df-ed0aae1a647c', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 12, 'Reis', null, 'als Beilage', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('cd3af2de-8b26-58ab-ae28-3a64efb36ea0', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 0, null, 'Reis kochen.', null, false, null, null, null, false, array['8241654d-8cb6-5f23-a1df-ed0aae1a647c']::uuid[]),
    ('4e46de1a-23f7-57a8-ab58-9cff669d2bd6', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 1, null, 'Tofu würfeln, in leicht gesalzenem Wasser 3 min blanchieren. Vorsichtig abgießen.', 180, false, null, null, null, false, array['63b66605-545f-5e14-a8ef-3444b75d1908']::uuid[]),
    ('47396cb4-3216-5d53-ac35-0b11c9993521', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 2, null, 'Öl im Wok, Hack krümelig braten, rausnehmen.', null, false, null, null, null, false, array['61b713f3-7542-57b0-a0e4-b3cc92f4027e']::uuid[]),
    ('c791cc39-9303-5a09-a6bd-a45f1ba400c3', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 3, null, 'Etwas Öl dazu, Doubanjiang + Douchi 30 Sek in Öl rösten bis rot-orange.', null, false, null, null, null, false, array['22583506-fda1-5641-aac8-f81c8bf5569d', 'f573ba60-1a38-581e-af50-a6cc7d82b411']::uuid[]),
    ('2e2e3a72-dcd4-560f-a746-1d80707a446f', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 4, null, 'Knoblauch + Ingwer dazu, 30 Sek. Brühe + Sojasauce + Zucker dazu, aufkochen.', null, false, null, null, null, false, array['484a73e3-c7f0-5be5-a9a0-9a3dbde3714f', '9c97bd3f-3333-5007-ac27-e341563330be', '563cdfe5-f880-58df-a58a-c834c9a0be80', '4d1206af-481c-51d5-a394-e3556b72cd50', '4a6112c9-4d53-5467-ab0c-ca5e0a049209']::uuid[]),
    ('90f18292-ed4f-574c-a861-81e897a74129', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 5, null, 'Tofu + Hack rein, 5 min sanft köcheln (nicht rühren, nur schwenken).', 300, false, null, null, null, false, array['63b66605-545f-5e14-a8ef-3444b75d1908', '61b713f3-7542-57b0-a0e4-b3cc92f4027e']::uuid[]),
    ('0ce1bcb9-4f43-54b8-ad8f-ae58b21e02ae', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 6, null, 'Stärkemischung (mit 3 EL Wasser) einrühren, 1 min binden.', 60, false, null, null, null, false, '{}'::uuid[]),
    ('5dcd3658-cdb5-5861-ab43-ac5b626f7541', h, '48a52e34-a191-5dda-aaff-ccdff8a4fe1d', 7, null, 'Sichuanpfeffer (geröstet + gemörsert) + Lauchzwiebel drüber.', null, false, null, null, null, false, array['cce06324-9801-511c-aca1-ae8638e17210', 'a329f178-d9a8-57b2-ab3d-b94fdf65ccea']::uuid[])
    on conflict (id) do nothing;

  -- Caponata
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('ffe5a1cb-6135-5cf7-a71a-486e14567a48', h, 'Caponata', 'mealprep', 45, 4, true, array['pfanne']::text[], 'Vorrat-Held. Hält 5 Tage. Auf Brot, zu Fisch, als Pasta-Sauce (verdünnt).', 'Für ihre Portion Essig halbieren. Mit Ciabatta und Mozzarella.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('15cdaad0-d5df-5571-acf7-169f96904ee1', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 0, 'Auberginen', 2, 'Stück', false, 'obst_gemuese'),
    ('e2e81232-0bc4-503a-a5f0-926fce298793', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 1, 'Sellerie', 1, 'Stange', false, 'obst_gemuese'),
    ('cc39b4e9-0d21-543b-aa59-01a80c094ee5', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 2, 'Zwiebeln', 2, 'Stück', true, 'obst_gemuese'),
    ('6074ed2c-a790-59c4-abb5-999065d7be53', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 3, 'Dosentomaten', 400, 'g', true, 'trocken'),
    ('47118b94-3f74-5ab0-ad41-41ddb3de332b', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 4, 'Grüne Oliven', 100, 'g', false, 'sonstiges'),
    ('f7aa77fc-5351-5c00-a7e9-c8fb15d8ad45', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 5, 'Kapern', 2, 'EL', true, 'obst_gemuese'),
    ('9f083b79-8bce-5b84-abb4-a2b5fe15e9d6', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 6, 'Rotweinessig', 3, 'EL', true, 'trocken'),
    ('e64b632e-c572-5684-a18f-dc3dbca418b3', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 7, 'Zucker', 2, 'EL', true, 'trocken'),
    ('385b1cfa-3fbc-5c1a-ae46-25501efc7e30', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 8, 'Pinienkerne', 30, 'g', true, 'trocken'),
    ('017aaebe-1fa2-527b-af46-4d0cbae1b47f', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 9, 'Rosinen (optional)', 30, 'g', true, 'sonstiges'),
    ('3ee84613-628f-52b3-a551-7dcf0b4c9fcd', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 10, 'Olivenöl + Basilikum', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('619d751d-e44f-5002-a695-d9502c49be0f', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 0, null, 'Auberginen (in 2 cm Würfeln) in viel Olivenöl in Pfanne goldbraun braten (ca. 8 min), rausnehmen.', 480, false, null, null, null, false, array['15cdaad0-d5df-5571-acf7-169f96904ee1', '47118b94-3f74-5ab0-ad41-41ddb3de332b', '3ee84613-628f-52b3-a551-7dcf0b4c9fcd']::uuid[]),
    ('6a5528dd-8751-5aa0-ad33-b112fc7b2281', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 1, null, 'Sellerie + Zwiebeln im selben Öl 8 min weich braten.', 480, false, null, null, null, false, array['e2e81232-0bc4-503a-a5f0-926fce298793', 'cc39b4e9-0d21-543b-aa59-01a80c094ee5']::uuid[]),
    ('bab2fd1a-c3f5-54af-aff0-ef0e28b05f1a', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 2, null, 'Tomaten + Oliven + Kapern + Rosinen dazu, 10 min köcheln.', 600, false, null, null, null, false, array['6074ed2c-a790-59c4-abb5-999065d7be53', '47118b94-3f74-5ab0-ad41-41ddb3de332b', 'f7aa77fc-5351-5c00-a7e9-c8fb15d8ad45', '017aaebe-1fa2-527b-af46-4d0cbae1b47f', '3ee84613-628f-52b3-a551-7dcf0b4c9fcd']::uuid[]),
    ('b66b7c45-24c6-52c2-a2d9-62c4619784ca', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 3, null, 'Auberginen zurück.', null, false, null, null, null, false, array['15cdaad0-d5df-5571-acf7-169f96904ee1']::uuid[]),
    ('748ed751-204c-53a0-a710-7a2a0a0057b7', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 4, null, 'Agrodolce: Essig + Zucker in kleiner Pfanne kurz aufkochen bis sirupartig, über die Caponata. 5 min weiter köcheln.', 300, false, null, null, null, false, array['9f083b79-8bce-5b84-abb4-a2b5fe15e9d6', 'e64b632e-c572-5684-a18f-dc3dbca418b3']::uuid[]),
    ('1688b77a-3b19-55b0-a727-2d66d43a0777', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 5, null, 'Pinienkerne anrösten, drüber.', null, false, null, null, null, false, array['385b1cfa-3fbc-5c1a-ae46-25501efc7e30']::uuid[]),
    ('6cc64a5a-f376-52a1-ad6c-40668e8fb1ad', h, 'ffe5a1cb-6135-5cf7-a71a-486e14567a48', 6, null, 'Abkühlen lassen, Basilikum drauf. Schmeckt lauwarm oder kalt am besten, am nächsten Tag noch besser.', null, false, null, null, null, false, array['3ee84613-628f-52b3-a551-7dcf0b4c9fcd']::uuid[])
    on conflict (id) do nothing;

  -- Baba Ganoush + Lamm-Kofta
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('b94290e8-f589-54cf-a5e7-02dab461d7cc', h, 'Baba Ganoush + Lamm-Kofta', 'wochenende', 60, 3, true, array['ofen', 'plancha', 'pfanne']::text[], 'Baba Ganoush auf Vorrat machen. Auberginen kann man auf dem BGE rauchig grillen statt im Ofen.', 'Kofta ohne Gewürze separat formen (nur Fleisch + Salz). Joghurt + Fladenbrot + Gurke. Baba Ganoush ist ihr oft zu rauchig.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('4abe3288-be1e-5947-a66e-94c59ef266c0', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 0, 'Auberginen (große)', 2, 'Stück', false, 'obst_gemuese'),
    ('69648ee8-189b-5137-a3eb-f6056634bcc7', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 1, 'Tahini', 3, 'EL', true, 'sonstiges'),
    ('4608a9c9-4e4f-5247-aef9-5b2d61c0fc27', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 2, 'Knoblauch', 2, 'Zehen', true, 'obst_gemuese'),
    ('83907f5a-5c70-5a36-a828-f91e297bd339', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 3, 'Zitrone', 1, 'Stück', false, 'obst_gemuese'),
    ('c19f1c93-f8ab-535b-a6e8-2ed5f7641a47', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 4, 'Olivenöl', 2, 'EL', true, 'trocken'),
    ('7f0e8e28-93bd-57a5-a22b-351af29f321f', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 5, 'Lammhack (oder Mischhack)', 500, 'g', false, 'kuehl'),
    ('6250bdf2-15e4-50c2-ae54-23432be2a566', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 6, 'Zwiebel', 1, 'Stück', true, 'obst_gemuese'),
    ('8f994a22-d035-569b-a5de-14b21d4691df', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 7, 'Petersilie', 1, 'Bund', false, 'obst_gemuese'),
    ('6c6ae0b0-b284-56f9-aa1e-f6b55d08cca0', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 8, 'Kreuzkümmel, Piment, Paprika, Zimt', null, 'je 1 TL / ½ TL', true, 'obst_gemuese'),
    ('2d4e9ee2-1434-5a2d-a764-4bf17feac356', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 9, 'Holzspieße', 8, 'Stück', false, 'sonstiges'),
    ('fa3ff1d4-4620-563b-a091-e731edc4c0e2', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 10, 'Fladenbrot + Joghurt + Salat', null, '', false, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('193dcc61-3067-519a-a25a-c3ca170e0e40', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 0, null, 'Auberginen mit Gabel einstechen. Ofen 220°C, 40 min – bis Haut schwarz und Inneres butterweich.', 2400, false, null, null, null, false, array['4abe3288-be1e-5947-a66e-94c59ef266c0']::uuid[]),
    ('a776b98b-6ef4-5eea-a1dc-dcaae0975297', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 1, null, 'Inzwischen Kofta: alle Zutaten (Hack + fein gehackte Zwiebel + Knoblauch + Petersilie + Gewürze) mit Händen kneten, um Spieße formen (zigarrenform).', null, false, null, null, null, false, array['4608a9c9-4e4f-5247-aef9-5b2d61c0fc27', '7f0e8e28-93bd-57a5-a22b-351af29f321f', '6250bdf2-15e4-50c2-ae54-23432be2a566', '8f994a22-d035-569b-a5de-14b21d4691df', '2d4e9ee2-1434-5a2d-a764-4bf17feac356']::uuid[]),
    ('05a7c559-5fd7-5c24-a443-075f999eb56d', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 2, null, 'Auberginen leicht abkühlen, aufschneiden, Fruchtfleisch rausschaben. Mit Tahini + Knoblauch + Zitrone + Olivenöl mixen oder mit Gabel zerdrücken (rustikaler). Salz.', null, false, null, null, null, false, array['4abe3288-be1e-5947-a66e-94c59ef266c0', '69648ee8-189b-5137-a3eb-f6056634bcc7', '4608a9c9-4e4f-5247-aef9-5b2d61c0fc27', '83907f5a-5c70-5a36-a828-f91e297bd339', 'c19f1c93-f8ab-535b-a6e8-2ed5f7641a47']::uuid[]),
    ('600c8cab-0fa5-5150-a41b-92d1d91400ec', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 3, null, 'Kofta in Pfanne/Plancha je 3 min pro Seite scharf anbraten.', 180, false, null, null, null, false, '{}'::uuid[]),
    ('d7ccd3a4-2700-5121-a310-64ef6da7577b', h, 'b94290e8-f589-54cf-a5e7-02dab461d7cc', 4, null, 'Alles anrichten: Baba Ganoush, Kofta, Joghurtsauce (Joghurt + Knoblauch + Zitrone + Minze), Salat, Fladenbrot.', null, false, null, null, null, false, array['4608a9c9-4e4f-5247-aef9-5b2d61c0fc27', '83907f5a-5c70-5a36-a828-f91e297bd339', 'fa3ff1d4-4620-563b-a091-e731edc4c0e2']::uuid[])
    on conflict (id) do nothing;

  -- Bun Bo Nam Bo
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('8cfd60d4-43b0-5515-aa44-4f23b3792a99', h, 'Bun Bo Nam Bo', 'schnell', 40, 3, true, array['pfanne', 'topf']::text[], 'Bun Cha (Hanoi-Version) ist mit gegrilltem Schweinefleisch vom BGE – auch super.', 'Nudeln + Rindfleisch (nur mit Salz gebraten, nicht aus Marinade) pur. Karotte + Gurke separat. Kein Nuoc Cham – milde Sojasauce.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('99b52a5a-25d0-53cb-ae66-cee783953278', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 0, 'Reisnudeln (Vermicelli)', 300, 'g', true, 'trocken'),
    ('a4848649-eaa3-519d-a027-3d627e27172c', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 1, 'Rinderfiletspitzen oder Rumpsteak', 500, 'g', false, 'kuehl'),
    ('67fa4337-8b93-52d9-ab2e-cbdd061d7917', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 2, 'Karotten', 2, 'Stück', false, 'obst_gemuese'),
    ('47afe9dc-683d-5173-a811-b590979bd8ef', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 3, 'Gurke', 1, 'Stück', false, 'obst_gemuese'),
    ('9162c5fb-4dca-512c-a3ec-0dc196abf771', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 4, 'Kopfsalat', 1, 'kleiner', false, 'obst_gemuese'),
    ('6b4fc547-21da-5135-a0a6-42c639aa19f1', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 5, 'Sojasprossen', 1, 'Handvoll', false, 'sonstiges'),
    ('99360a43-3083-5684-aed7-f75cfb29dda8', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 6, 'Minze, Koriander, Thai-Basilikum', null, '', false, 'obst_gemuese'),
    ('405ea895-60f8-5590-aabb-7d1e2eaddf01', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 7, 'Geröstete Erdnüsse', 1, 'Handvoll', true, 'trocken'),
    ('d86029fd-be94-5d7e-aa6e-f40e76c96607', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 8, 'Zitronengras', 2, 'Stangen', true, 'obst_gemuese'),
    ('650a89e8-2ed6-5a5b-aaa0-00c711719ab2', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 9, 'Fischsauce, Sojasauce, Zucker, Limettensaft, Knoblauch, Chili', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('63c741ad-516b-507c-a85d-c7116f7f9020', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 0, null, 'Marinade: Knoblauch + Zitronengras (ganz fein) + Fischsauce + Sojasauce + Zucker + Öl. Rindfleisch (in Streifen) mind. 15 min drin ziehen lassen.', null, false, null, null, null, false, array['d86029fd-be94-5d7e-aa6e-f40e76c96607', '650a89e8-2ed6-5a5b-aaa0-00c711719ab2']::uuid[]),
    ('6f5b4a00-dfba-540c-af97-250285953157', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 1, null, 'Reisnudeln nach Packung (meist 3–5 min in heißem Wasser), kalt abschrecken.', 180, false, null, null, null, false, array['99b52a5a-25d0-53cb-ae66-cee783953278']::uuid[]),
    ('9d996bae-2e0e-56a9-a6b5-f5338c068600', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 2, null, 'Nuoc Cham: 4 EL Fischsauce + 4 EL Wasser + 3 EL Zucker + 3 EL Limettensaft + Knoblauch + Chili verrühren.', null, false, null, null, null, false, array['650a89e8-2ed6-5a5b-aaa0-00c711719ab2']::uuid[]),
    ('4bdb3d5e-2a14-5da9-a8cb-eab7e3681783', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 3, null, 'Pfanne sehr heiß, Rindfleisch in Portionen 1–2 min scharf anbraten (nicht zerkochen).', 60, false, null, null, null, false, '{}'::uuid[]),
    ('4a7544e0-c3c3-5249-aed3-0e1e29d9df33', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 4, null, 'In Schüsseln schichten: Salat unten, Nudeln, Karotte (Julienne), Gurke (Julienne), Sprossen, Rindfleisch obendrauf. Kräuter + Erdnüsse.', null, false, null, null, null, false, array['99b52a5a-25d0-53cb-ae66-cee783953278', '67fa4337-8b93-52d9-ab2e-cbdd061d7917', '47afe9dc-683d-5173-a811-b590979bd8ef', '9162c5fb-4dca-512c-a3ec-0dc196abf771', '6b4fc547-21da-5135-a0a6-42c639aa19f1', '405ea895-60f8-5590-aabb-7d1e2eaddf01']::uuid[]),
    ('25c77858-83b5-5f01-a12c-4b68d9ff7364', h, '8cfd60d4-43b0-5515-aa44-4f23b3792a99', 5, null, 'Nuoc Cham drüber – jeder nach Geschmack.', null, false, null, null, null, false, '{}'::uuid[])
    on conflict (id) do nothing;

  -- Gemüse-Ofen-Gratin
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('f73512a6-de87-54c4-a31d-1bc18053a3d6', h, 'Gemüse-Ofen-Gratin', 'mealprep', 55, 4, true, array['ofen']::text[], 'Geht auch mit Süßkartoffel statt normaler Kartoffel + Feta statt Parmesan.', 'Liebt das wie es ist. Ihre Portion extra lang ziehen lassen damit Kartoffeln wirklich weich sind. Weniger Knoblauch in ihrer Ecke.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('b7c33b51-f59b-5845-a15b-75606b54007a', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 0, 'Kartoffeln (festkochend)', 4, 'Stück', false, 'obst_gemuese'),
    ('76ca3d93-4d20-5797-a553-2ee0091e7efd', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 1, 'Zucchini', 2, 'Stück', false, 'sonstiges'),
    ('3dcc6a80-81b9-5ef0-abf8-5492fad312ca', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 2, 'Tomaten', 2, 'Stück', false, 'obst_gemuese'),
    ('4f68fc1f-9054-5667-a4ed-fb1f11543d41', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 3, 'Zwiebel', 1, 'Stück', true, 'obst_gemuese'),
    ('614f58e5-0d7d-5cce-aad4-83d34b169aa2', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 4, 'Knoblauch', 3, 'Zehen', true, 'obst_gemuese'),
    ('938866a2-4e6a-5f2c-ab77-a5ad69fd5469', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 5, 'Sahne', 200, 'ml', false, 'kuehl'),
    ('bb067743-f6f3-57d8-a391-0cef4fe001c9', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 6, 'Milch', 100, 'ml', false, 'kuehl'),
    ('a6fcce43-841d-55a4-a828-0c323a1acdb9', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 7, 'Parmesan oder Gruyère', 100, 'g', true, 'kuehl'),
    ('def08ccf-8eac-5f41-a3b2-27e2eaf5e892', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 8, 'Thymian, Rosmarin', null, '', true, 'obst_gemuese'),
    ('574c990d-b25f-539c-a88a-b962f5b4ce1b', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 9, 'Olivenöl, Salz, Pfeffer', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('deada8f7-7292-51c0-aa7a-c7f2300ec980', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 0, null, 'Ofen 190°C vorheizen. Auflaufform mit Olivenöl einreiben.', null, false, null, null, null, false, array['574c990d-b25f-539c-a88a-b962f5b4ce1b']::uuid[]),
    ('f180a22c-c3d1-5bbe-ae8e-53ebe9c38617', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 1, null, 'Kartoffel-, Zucchini-, Tomaten-, Zwiebel-Scheiben in Schichten dachziegelartig einlegen. Zwischendurch salzen, pfeffern, Kräuter + Knoblauch streuen.', null, false, null, null, null, false, array['b7c33b51-f59b-5845-a15b-75606b54007a', '76ca3d93-4d20-5797-a553-2ee0091e7efd', '3dcc6a80-81b9-5ef0-abf8-5492fad312ca', '4f68fc1f-9054-5667-a4ed-fb1f11543d41', '614f58e5-0d7d-5cce-aad4-83d34b169aa2', '574c990d-b25f-539c-a88a-b962f5b4ce1b']::uuid[]),
    ('667005db-f98f-5a82-aa94-91435039ffda', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 2, null, 'Sahne + Milch verrühren, drübergießen.', null, false, null, null, null, false, array['938866a2-4e6a-5f2c-ab77-a5ad69fd5469', 'bb067743-f6f3-57d8-a391-0cef4fe001c9']::uuid[]),
    ('25189ee3-9fd1-5967-a6f8-9ce1ebdaa479', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 3, null, 'Parmesan/Gruyère drauf.', null, false, null, null, null, false, array['a6fcce43-841d-55a4-a828-0c323a1acdb9']::uuid[]),
    ('1bfddc23-d793-589b-a583-25263ae538b1', h, 'f73512a6-de87-54c4-a31d-1bc18053a3d6', 4, null, '35 min backen – obenauf goldbraun, Kartoffeln weich.', 2100, false, null, null, null, false, array['b7c33b51-f59b-5845-a15b-75606b54007a']::uuid[])
    on conflict (id) do nothing;

  -- Pho Bo
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('ef687cf1-3127-57f4-a184-6a6a335684e6', h, 'Pho Bo', 'wochenende', 240, 6, true, array['topf']::text[], 'Brühe in großer Menge machen und in 500ml-Portionen einfrieren – dann ist Pho ein 15-Min-Gericht. Classic Wochenend-Investment.', 'Brühe + Nudeln + gekochte Rinderbrust pur. Sojasauce zum Tunken. Sie mag Nudelsuppe.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('4b292712-2cb6-5f41-adf3-c5c1af86efeb', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 0, 'Rinderknochen', 1500, 'g', false, 'kuehl'),
    ('45006591-5b02-5932-af2e-200e726ef1ac', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 1, 'Rinderbrust', 500, 'g', false, 'kuehl'),
    ('64884eaa-4369-5934-a0e8-8f51b00154ad', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 2, 'Zwiebeln', 2, 'Stück', true, 'obst_gemuese'),
    ('630d2a25-ea18-59a0-a84f-a953929f1221', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 3, 'Ingwer', 10, 'cm', true, 'obst_gemuese'),
    ('ad4856ca-5aff-5840-a9f8-d3d8cdec9f46', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 4, 'Sternanis, Zimtstange, Nelken, Kardamom, Koriandersamen, Fenchelsamen', null, '', true, 'obst_gemuese'),
    ('5d5a94b6-654f-5752-aa1c-ce43aedfd2fc', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 5, 'Fischsauce', 2, 'EL', true, 'trocken'),
    ('0dc35a62-a298-5af8-a2b4-46ca4a4a634b', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 6, 'Zucker', 1, 'EL', true, 'trocken'),
    ('19af8161-f75c-5230-a9d5-1a8a7c2dd24e', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 7, 'Reisnudeln (flach, Pho-Style)', 400, 'g', true, 'trocken'),
    ('df2ea363-048a-56f7-a128-6d81f792d7fe', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 8, 'Rindfiletspitzen (hauchdünn)', 300, 'g', false, 'kuehl'),
    ('12415df3-62a1-53b9-a885-cfd56e71298b', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 9, 'Thai-Basilikum, Koriander, Minze', null, '', false, 'obst_gemuese'),
    ('1bf7fa32-d270-51e9-a485-988dc162e9ae', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 10, 'Sojasprossen, Limette, Chili, Lauchzwiebel', null, '', false, 'obst_gemuese'),
    ('efeb591c-21d9-53f7-a45b-8b44ab219dd5', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 11, 'Hoisin-Sauce, Sriracha', null, '', true, 'sonstiges')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('28cbd9c3-e81e-5f78-ab52-970837aa4af4', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 0, null, 'Knochen + Brust in kaltem Wasser aufkochen, 10 min abschäumen, Wasser wegschütten, Fleisch abspülen. (Entfernt Trübstoffe – wichtig für klare Brühe!)', 600, false, null, null, null, false, array['4b292712-2cb6-5f41-adf3-c5c1af86efeb', '45006591-5b02-5932-af2e-200e726ef1ac']::uuid[]),
    ('2f8d0b69-f6f9-56cd-ab9e-346ab9861784', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 1, null, 'Zwiebel + Ingwer trocken in der Pfanne schwarz anrösten. Gibt den Geschmack.', null, false, null, null, null, false, array['64884eaa-4369-5934-a0e8-8f51b00154ad', '630d2a25-ea18-59a0-a84f-a953929f1221', '1bf7fa32-d270-51e9-a485-988dc162e9ae']::uuid[]),
    ('ecc5e362-c6f5-55ed-aae6-cc82bb3e669e', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 2, null, 'Gewürze 2 min trocken in der Pfanne rösten.', 120, false, null, null, null, false, '{}'::uuid[]),
    ('4dd4e188-4b6c-542c-addf-00e9a0b1c39b', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 3, null, 'Knochen, Fleisch, Zwiebel, Ingwer, Gewürze (in Tuch) in großen Topf mit 4 L Wasser. Aufkochen, dann 3h bei kleinster Flamme simmern.', 10800, false, null, null, null, false, array['4b292712-2cb6-5f41-adf3-c5c1af86efeb', '64884eaa-4369-5934-a0e8-8f51b00154ad', '630d2a25-ea18-59a0-a84f-a953929f1221', '1bf7fa32-d270-51e9-a485-988dc162e9ae']::uuid[]),
    ('5545fdbe-ef23-555d-aca1-27d816566dfc', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 4, null, 'Brust nach 1,5h rausnehmen, in dünne Scheiben schneiden.', 18000, false, null, null, null, false, array['45006591-5b02-5932-af2e-200e726ef1ac']::uuid[]),
    ('b3b99d20-75fc-5fb0-aaab-ba4870f034b6', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 5, null, 'Brühe abseihen. Fischsauce + Zucker + Salz abschmecken.', null, false, null, null, null, false, array['5d5a94b6-654f-5752-aa1c-ce43aedfd2fc', '0dc35a62-a298-5af8-a2b4-46ca4a4a634b', 'efeb591c-21d9-53f7-a45b-8b44ab219dd5']::uuid[]),
    ('63ce8f4c-f0c9-568b-ac2a-9b0de06d1458', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 6, null, 'Nudeln nach Packung kochen.', null, false, null, null, null, false, array['19af8161-f75c-5230-a9d5-1a8a7c2dd24e']::uuid[]),
    ('adfc0deb-2c27-5f1a-a549-d75a36c2c398', h, 'ef687cf1-3127-57f4-a184-6a6a335684e6', 7, null, 'In Schalen: Nudeln unten, rohe Rindfleischscheiben + gekochte Brust obendrauf. Kochende Brühe drübergießen (gart rohes Fleisch). Kräuter, Sprossen, Limette, Chili.', null, false, null, null, null, false, array['45006591-5b02-5932-af2e-200e726ef1ac', '19af8161-f75c-5230-a9d5-1a8a7c2dd24e', '1bf7fa32-d270-51e9-a485-988dc162e9ae']::uuid[])
    on conflict (id) do nothing;

  -- Pulled Pork (Big Green Egg)
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('10eb3d3e-f482-579b-acf5-73de88578bd6', h, 'Pulled Pork (Big Green Egg)', 'grill', 600, 10, true, array['bge']::text[], '8–10 Portionen! 2 für heute, 4 in den Freezer als Cubes (für Quesadillas, Wraps, über Reis). Ultimative Freezer-Held.', 'Fleisch vor dem Mischen mit BBQ-Sauce abzweigen. Bun + Pulled Pork pur + Apfelstücke. Sie liebt das.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('2324c248-a668-5fa9-aebf-b751fca5e1b5', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 0, 'Schweinenacken (mit Fettkappe)', 2500, 'g', false, 'kuehl'),
    ('c064f726-0547-50cd-ae09-4140a990bc21', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 1, 'Hickory- oder Apfelholz', null, '', false, 'obst_gemuese'),
    ('bbdfac3c-29a6-5e12-affd-f0c5bf26a654', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 2, 'Brauner Zucker', 3, 'EL', true, 'trocken'),
    ('f4635cb3-5991-5afe-ad3e-594e3313a19f', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 3, 'Paprika edelsüß', 2, 'EL', true, 'obst_gemuese'),
    ('01e6880a-8026-5293-afe6-56437c728a9b', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 4, 'Meersalz', 2, 'EL', true, 'sonstiges'),
    ('156359fb-84af-55f5-a571-240cd14a8b50', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 5, 'Schwarzer Pfeffer, Knoblauchpulver, Zwiebelpulver, Senfpulver', null, 'je 1 EL', true, 'trocken'),
    ('886adc2a-8a55-5c58-a8fc-3f91dfacb67e', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 6, 'Cayenne + Kreuzkümmel', null, 'je 1 TL', true, 'sonstiges'),
    ('4e77abff-f123-5515-a21a-9674dadc6a0f', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 7, 'Apfelsaft + Apfelessig', 300, 'ml (Mop)', false, 'trocken'),
    ('418da168-682d-59da-a842-d5bd1077cef5', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 8, 'Burger Buns oder Wraps', null, '', false, 'sonstiges'),
    ('b5862790-093d-5a47-a232-907252c9a413', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 9, 'Rotkohl + Karotte + Mayo (Slaw)', null, '', false, 'obst_gemuese'),
    ('892f4cc0-083a-5851-a779-346fc6a4b1e0', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 10, 'BBQ-Sauce', null, '', true, 'sonstiges')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('447716eb-6d11-5946-a788-3cc537e311ec', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 0, null, 'Rub (alle Gewürze mischen) gut einmassieren. Am Vorabend ideal, mind. 1h im Kühlschrank.', null, false, null, null, null, false, '{}'::uuid[]),
    ('70a14e88-8a1a-5dc9-af92-06ca672a54d3', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 1, null, 'BGE auf 110°C indirekt einregeln, Deflector einlegen, 2–3 Hickory-Stücke rein.', null, false, null, null, null, false, array['c064f726-0547-50cd-ae09-4140a990bc21']::uuid[]),
    ('9fe08b37-dd86-5811-a070-4e571ea5fb97', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 2, null, 'Fleisch auf den Rost, Temperaturfühler rein. Ziel-Kerntemperatur: 93°C.', null, false, null, null, null, false, '{}'::uuid[]),
    ('561eae2b-c5f9-5a55-a92d-cf8218144114', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 3, null, 'Nach 4h Mop Sauce (Apfelsaft + Apfelessig + 1 EL Rub) alle Stunde auftragen.', 14400, false, null, null, null, false, array['4e77abff-f123-5515-a21a-9674dadc6a0f', '892f4cc0-083a-5851-a779-346fc6a4b1e0']::uuid[]),
    ('fc30b485-d6a8-5f08-ac25-8cd784824dff', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 4, null, 'Bei 70°C Kerntemperatur "Stall" – kann 1–2h stehen (normal!). Eventuell Texas Crutch: in Alufolie wickeln.', 7200, false, null, null, null, false, '{}'::uuid[]),
    ('278e589b-cab4-5907-a46d-63d7a5b199a4', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 5, null, 'Bei 93°C fertig. 30 min in Folie ruhen lassen.', 1800, false, null, null, null, false, '{}'::uuid[]),
    ('6de30ec4-7b9c-57bc-a0e4-05a0e58501a0', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 6, null, 'Mit zwei Gabeln zerrupfen ("pullen"). Mit BBQ-Sauce vermischen.', null, false, null, null, null, false, array['892f4cc0-083a-5851-a779-346fc6a4b1e0']::uuid[]),
    ('07e76e0d-e399-5509-a66f-5b97fff68c81', h, '10eb3d3e-f482-579b-acf5-73de88578bd6', 7, null, 'Auf Buns mit Slaw servieren.', null, false, null, null, null, false, array['418da168-682d-59da-a842-d5bd1077cef5']::uuid[])
    on conflict (id) do nothing;

  -- Rotisserie-Hähnchen (Big Green Egg)
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('194c2680-51f7-56ee-a4a6-1926fd2355c1', h, 'Rotisserie-Hähnchen (Big Green Egg)', 'grill', 90, 3, true, array['bge']::text[], 'Reste-Magie: morgen als Wraps, übermorgen als Huhn-Nudel-Suppe mit Karkasse-Brühe. 3 Mahlzeiten aus einem Huhn.', 'Liebt gegrilltes Huhn – Brust ohne Haut, kleingeschnitten, mit Kartoffelspalten. Keine Anpassung nötig.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('6c0f0cc1-a5ce-554a-a201-c90c6c384217', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 0, 'Ganzes Bio-Hähnchen', 1800, 'g', false, 'kuehl'),
    ('fa5d9e2d-96a3-5541-ac17-7293af3baf86', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 1, 'Zitronen', 2, 'Stück', false, 'obst_gemuese'),
    ('7900eeda-c039-5c58-ac93-e6801e784ad2', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 2, 'Knoblauchknolle', 1, 'Stück', true, 'obst_gemuese'),
    ('cf5f14f4-7e81-5ccf-ad6b-948d1143d67a', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 3, 'Thymian, Rosmarin', null, 'frisch', false, 'obst_gemuese'),
    ('bac24b9c-37d0-5da0-ac2a-5efd00d793f9', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 4, 'Butter (weich)', 50, 'g', true, 'kuehl'),
    ('df311acd-e012-5077-a766-db64dc8c8077', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 5, 'Salz, Pfeffer, Paprika edelsüß', null, '', true, 'obst_gemuese'),
    ('7741e3fd-a49b-521a-ab2e-727c2b65fae9', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 6, 'Olivenöl + Küchengarn', null, '', true, 'trocken'),
    ('40cdaa19-4067-5bd9-a233-b150902ed832', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 7, 'Kartoffeln (Spalten)', null, 'als Beilage', false, 'obst_gemuese')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('8bda03ac-3f66-5b4a-a185-f29b2e26f2f5', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 0, null, 'Hähnchen innen + außen trocken tupfen. Salzen, pfeffern (auch innen).', null, false, null, null, null, false, array['6c0f0cc1-a5ce-554a-a201-c90c6c384217', 'df311acd-e012-5077-a766-db64dc8c8077']::uuid[]),
    ('6a9ba6a0-dbf0-56e5-af47-dae574016558', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 1, null, 'Kräuterbutter: Butter + Thymian + Rosmarin + Knoblauch + Paprika verrühren. Unter die Haut der Brust schieben.', null, false, null, null, null, false, array['7900eeda-c039-5c58-ac93-e6801e784ad2', 'cf5f14f4-7e81-5ccf-ad6b-948d1143d67a', 'bac24b9c-37d0-5da0-ac2a-5efd00d793f9', 'df311acd-e012-5077-a766-db64dc8c8077']::uuid[]),
    ('4ea0ad2f-13a7-5117-a7e7-1f36ad7545b4', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 2, null, 'Innen: halbierte Zitrone + Knoblauchknolle reinstopfen.', null, false, null, null, null, false, array['fa5d9e2d-96a3-5541-ac17-7293af3baf86', '7900eeda-c039-5c58-ac93-e6801e784ad2']::uuid[]),
    ('c565c244-54b5-50c0-ae64-19c45dd69a20', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 3, null, 'Mit Küchengarn verschnüren (Beine zusammen, Flügel anlegen).', null, false, null, null, null, false, array['7741e3fd-a49b-521a-ab2e-727c2b65fae9']::uuid[]),
    ('ee406c33-3b51-59e4-aa94-09d1a7902b22', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 4, null, 'BGE auf 180°C indirekt. Hähnchen auf Rotisserie-Spieß, einspannen.', null, false, null, null, null, false, array['6c0f0cc1-a5ce-554a-a201-c90c6c384217']::uuid[]),
    ('110503a1-3553-5eb1-a77e-bad7d0bc68ba', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 5, null, '1h 15 min rotieren lassen (bis Brust 75°C Kerntemperatur).', 4500, false, null, null, null, false, '{}'::uuid[]),
    ('df54b986-eef5-59f3-aaa7-7fc3ea640e5f', h, '194c2680-51f7-56ee-a4a6-1926fd2355c1', 6, null, '10 min ruhen lassen, tranchieren.', 600, false, null, null, null, false, '{}'::uuid[])
    on conflict (id) do nothing;

  -- Boeuf Bourguignon (Dutch Oven)
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('d2f50e21-dcb8-5350-adf5-058265ea3e5d', h, 'Boeuf Bourguignon (Dutch Oven)', 'wochenende', 180, 6, true, array['dutch_oven']::text[], 'Am nächsten Tag schmeckt''s noch besser. Perfektes Gericht wenn Besuch kommt.', 'Rindfleischwürfel + Karotten aus dem Topf fischen, ohne Weinsauce, zu Kartoffelpüree. Sie isst überraschend gern Schmorfleisch.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('ab241fa2-0287-56f2-a6e8-53625b0f359d', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 0, 'Rindfleisch aus der Schulter (4 cm Würfel)', 1500, 'g', false, 'kuehl'),
    ('35766836-fb32-51a9-a681-1ec6188a9f6b', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 1, 'Speck', 150, 'g', false, 'kuehl'),
    ('a94f917e-e88a-56f8-ac39-6d4e0f4ecd17', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 2, 'Zwiebeln', 2, 'Stück', true, 'obst_gemuese'),
    ('1205e40d-100b-524a-a935-6c4af6abc8a8', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 3, 'Karotten', 3, 'Stück', false, 'obst_gemuese'),
    ('751bfc10-9883-5678-a7a8-57d4dc02f0a8', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 4, 'Knoblauch', 4, 'Zehen', true, 'obst_gemuese'),
    ('894b14f5-5cd0-5654-a21c-dbdc04635a92', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 5, 'Mehl', 2, 'EL', true, 'trocken'),
    ('d8e4e855-6972-5802-ad3d-fbf46a65bf1c', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 6, 'Burgunderwein (oder guter Rotwein)', 750, 'ml', false, 'getraenke'),
    ('5f692af7-fd50-570e-a9da-bf75f6a84c61', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 7, 'Rinderbrühe', 500, 'ml', true, 'trocken'),
    ('bb800319-9678-55bf-ae44-9590682071f2', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 8, 'Tomatenmark', 1, 'EL', true, 'trocken'),
    ('fb12b9df-d5d3-5938-adf1-34a054928720', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 9, 'Bouquet garni (Thymian, Rosmarin, Lorbeer, Petersilie)', 1, 'Stück', true, 'obst_gemuese'),
    ('7d04e82d-6059-50f6-ac3d-40fde41bd266', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 10, 'Perlzwiebeln (oder Schalotten)', 250, 'g', false, 'obst_gemuese'),
    ('996d2255-08d6-5a8b-a51b-b41d066c4488', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 11, 'Champignons', 300, 'g', false, 'sonstiges'),
    ('7a585ebc-e7df-52f6-a481-5479060dbe68', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 12, 'Butter, Salz, Pfeffer', null, '', true, 'kuehl'),
    ('a1064ec8-68ac-5f4b-ac46-47fdb175d6b0', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 13, 'Kartoffelpüree oder Baguette', null, 'als Beilage', false, 'obst_gemuese')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('cd8e5cd7-a690-5bdc-ac5a-4145cd358d81', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 0, null, 'Ofen auf 160°C vorheizen.', null, false, null, null, null, false, '{}'::uuid[]),
    ('33764410-2e87-50a1-ac9e-848211869ae9', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 1, null, 'Im Dutch Oven Speck kross braten, rausnehmen.', null, false, null, null, null, false, array['35766836-fb32-51a9-a681-1ec6188a9f6b']::uuid[]),
    ('88ec973c-19fb-5992-a559-9901ef014a01', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 2, null, 'Rindfleisch trocken tupfen, in Portionen scharf anbraten bis braun. NICHT zerkochen! Rausnehmen.', null, false, null, null, null, false, array['ab241fa2-0287-56f2-a6e8-53625b0f359d']::uuid[]),
    ('f34d73b3-0a1c-505b-a432-304aa9c0204b', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 3, null, 'Zwiebeln + Karotten 5 min anbraten. Knoblauch + Tomatenmark, 1 min.', 300, false, null, null, null, false, array['a94f917e-e88a-56f8-ac39-6d4e0f4ecd17', '1205e40d-100b-524a-a935-6c4af6abc8a8', '751bfc10-9883-5678-a7a8-57d4dc02f0a8', 'bb800319-9678-55bf-ae44-9590682071f2', '7d04e82d-6059-50f6-ac3d-40fde41bd266']::uuid[]),
    ('e71631e1-279e-5445-ae5a-60abd30b867c', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 4, null, 'Mehl drüberstäuben, kurz mitrösten.', null, false, null, null, null, false, array['894b14f5-5cd0-5654-a21c-dbdc04635a92']::uuid[]),
    ('f47f31c4-2158-5e72-a17b-14f4852a7488', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 5, null, 'Wein + Brühe langsam unter Rühren. Fleisch + Speck zurück, Bouquet garni rein.', null, false, null, null, null, false, array['ab241fa2-0287-56f2-a6e8-53625b0f359d', '35766836-fb32-51a9-a681-1ec6188a9f6b', 'd8e4e855-6972-5802-ad3d-fbf46a65bf1c', '5f692af7-fd50-570e-a9da-bf75f6a84c61', 'fb12b9df-d5d3-5938-adf1-34a054928720']::uuid[]),
    ('4acf5b00-9785-5f9d-a79d-43bd4177f9c4', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 6, null, 'Aufkochen, Deckel drauf, 2,5h in den Ofen.', 18000, false, null, null, null, false, '{}'::uuid[]),
    ('2ac55fb8-8f15-5146-a45b-e7e0aa542792', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 7, null, 'In letzter halber Stunde: Perlzwiebeln + Champignons (geviertelt) in Butter anbraten und dazugeben.', null, false, null, null, null, false, array['a94f917e-e88a-56f8-ac39-6d4e0f4ecd17', '7d04e82d-6059-50f6-ac3d-40fde41bd266', '996d2255-08d6-5a8b-a51b-b41d066c4488', '7a585ebc-e7df-52f6-a481-5479060dbe68']::uuid[]),
    ('9a418b90-8b02-523e-a25d-df5e7f848a1d', h, 'd2f50e21-dcb8-5350-adf5-058265ea3e5d', 8, null, 'Bouquet garni raus. Salz, Pfeffer. Mit Kartoffelpüree oder Baguette servieren.', null, false, null, null, null, false, array['fb12b9df-d5d3-5938-adf1-34a054928720', '7a585ebc-e7df-52f6-a481-5479060dbe68', 'a1064ec8-68ac-5f4b-ac46-47fdb175d6b0']::uuid[])
    on conflict (id) do nothing;

  -- Moussaka mit Béchamel
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('adb1fe78-cd10-55b5-a364-4cbfb98c4638', h, 'Moussaka mit Béchamel', 'wochenende', 90, 6, true, array['ofen', 'pfanne']::text[], 'Moussaka braucht Ruhe zum Schneiden – sonst fällt sie auseinander. Am nächsten Tag noch besser.', 'Liebt Moussaka genauso wie sie ist. Kleinere Portion, gut abkühlen lassen.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('a26d7465-c71f-50ef-aaba-28ce2adbe6cb', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 0, 'Auberginen (in Scheiben, 1 cm)', 3, 'Stück', false, 'obst_gemuese'),
    ('570d2c96-5cb7-5483-a8e0-1e2144f51a44', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 1, 'Kartoffeln (in Scheiben)', 3, 'Stück', false, 'obst_gemuese'),
    ('7365c554-b213-5789-a258-48f0704f9482', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 2, 'Lammhack (oder gemischt)', 500, 'g', false, 'kuehl'),
    ('0093cc11-5382-5f03-ab59-d6eecedd0ec5', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 3, 'Zwiebeln', 2, 'Stück', true, 'obst_gemuese'),
    ('b4a557a2-e7f8-59d9-a66a-db4a8327fcf0', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 4, 'Knoblauch', 4, 'Zehen', true, 'obst_gemuese'),
    ('e65d1c52-d794-5347-a593-7d6d6e49bc08', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 5, 'Dosentomaten', 400, 'g', true, 'trocken'),
    ('0b714d79-515a-5f66-a4a0-e4722955d9d8', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 6, 'Rotwein', 200, 'ml', false, 'getraenke'),
    ('208497fd-154c-5a5a-a050-06a686003f19', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 7, 'Tomatenmark', 1, 'EL', true, 'trocken'),
    ('ac11565d-c03e-5a9f-ac9d-995a860b21cf', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 8, 'Zimt + Piment + Lorbeer', null, '', true, 'sonstiges'),
    ('0bec2e18-d069-50f6-add5-97a255815280', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 9, 'Butter (Béchamel)', 70, 'g', true, 'kuehl'),
    ('9c9bca95-71ab-5211-a9d1-efcb68b07eed', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 10, 'Mehl (Béchamel)', 70, 'g', true, 'trocken'),
    ('b863563e-ba40-5784-ab0f-da9d7c1bd36e', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 11, 'Milch warm (Béchamel)', 700, 'ml', true, 'kuehl'),
    ('404229f3-479f-5d4c-a891-582198d29ca2', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 12, 'Kefalotyri oder Parmesan', 100, 'g', true, 'kuehl'),
    ('5bee33ca-d25e-5403-a17e-f38a9bf4002c', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 13, 'Eigelb', 2, 'Stück', true, 'sonstiges'),
    ('38de30b5-0b9e-52a2-ac34-9eeaba119210', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 14, 'Muskat, Salz, Olivenöl', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('81846e91-ac53-5ba7-ad60-930849cd3dfe', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 0, null, 'Ofen 200°C vorheizen. Auberginen + Kartoffeln auf Blech, mit Öl bestreichen, salzen. 25 min vorbacken (Auberginen 15 min, weil weicher).', 1500, false, null, null, null, false, array['a26d7465-c71f-50ef-aaba-28ce2adbe6cb', '570d2c96-5cb7-5483-a8e0-1e2144f51a44', '38de30b5-0b9e-52a2-ac34-9eeaba119210']::uuid[]),
    ('c60d9fe2-441a-55be-a80a-c6043201195e', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 1, null, 'Fleisch-Sauce: Zwiebeln anbraten, Hack krümelig braten. Knoblauch + Tomatenmark + Gewürze. Wein dazu, reduzieren. Dosentomaten, 25 min simmern bis dick.', 1500, false, null, null, null, false, array['7365c554-b213-5789-a258-48f0704f9482', '0093cc11-5382-5f03-ab59-d6eecedd0ec5', 'b4a557a2-e7f8-59d9-a66a-db4a8327fcf0', 'e65d1c52-d794-5347-a593-7d6d6e49bc08', '0b714d79-515a-5f66-a4a0-e4722955d9d8', '208497fd-154c-5a5a-a050-06a686003f19']::uuid[]),
    ('25530c8f-682c-5843-a05c-0985cd0e7ac7', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 2, null, 'Béchamel: Butter schmelzen, Mehl 1 min mitrösten (Mehlschwitze). Milch langsam einrühren (ständig schlagen!). 5 min köcheln bis dick. Käse + Muskat. Vom Herd, Eigelb einrühren.', 60, false, null, null, null, false, array['0bec2e18-d069-50f6-add5-97a255815280', '9c9bca95-71ab-5211-a9d1-efcb68b07eed', 'b863563e-ba40-5784-ab0f-da9d7c1bd36e', '5bee33ca-d25e-5403-a17e-f38a9bf4002c', '38de30b5-0b9e-52a2-ac34-9eeaba119210']::uuid[]),
    ('6b068f44-535f-59a0-a3f8-802cd5cb4b48', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 3, null, 'Schichten: Kartoffeln → Auberginen → Fleischsauce → Auberginen → Béchamel obendrauf.', null, false, null, null, null, false, array['a26d7465-c71f-50ef-aaba-28ce2adbe6cb', '570d2c96-5cb7-5483-a8e0-1e2144f51a44']::uuid[]),
    ('87b9b3f7-01a2-5eb2-affa-c5fa38d41ef1', h, 'adb1fe78-cd10-55b5-a364-4cbfb98c4638', 4, null, 'Nochmal Käse drüber, 45 min bei 180°C backen bis goldbraun. 15 min ruhen lassen vor dem Servieren.', 2700, false, null, null, null, false, '{}'::uuid[])
    on conflict (id) do nothing;

  -- Ramen from Scratch (Shoyu-Basis)
  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values
    ('95181b33-4d23-5416-a0b3-cb408dc1222c', h, 'Ramen from Scratch (Shoyu-Basis)', 'wochenende', 150, 4, true, array['topf']::text[], 'Projekt-Rezept. Brühe in großer Menge machen und in 500ml-Portionen einfrieren. Dann sind spätere Ramen ein 20-Min-Gericht. Shoyu ist die zugänglichste Ramen-Variante.', 'Nudeln + klare Brühe + Hähnchenstücke + Ei – ohne Tare (Sojasauce separat zum Tunken). Sie liebt die Nudeln.', mx)
    on conflict (id) do nothing;
  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values
    ('ca72e94c-31b4-5f4c-ac20-01b977cfa746', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 0, 'Hähnchenknochen (oder Flügel)', 500, 'g', false, 'kuehl'),
    ('37dc2f34-4e1d-5368-a716-100996bdc09a', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 1, 'Rinderknochen (optional)', 200, 'g', false, 'kuehl'),
    ('46c508f6-6a57-5eca-a581-f8b2ee0304dd', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 2, 'Kombu (getrocknete Alge)', 10, 'cm Stück', true, 'sonstiges'),
    ('04a2c18c-ca54-596d-a152-94e6846d3528', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 3, 'Bonito-Flocken (Katsuobushi)', 30, 'g', true, 'trocken'),
    ('bf809ec8-3914-5383-ac1d-a4c534c3cbf7', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 4, 'Lauchzwiebeln, Ingwer, Knoblauch, Zwiebel (Brühe)', null, '', true, 'trocken'),
    ('0f72e968-3ae7-57c5-a21b-9921b8f26f42', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 5, 'Sojasauce (gute Qualität)', 100, 'ml', true, 'trocken'),
    ('57b4d2f8-be6f-52a2-a017-5a841192eaeb', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 6, 'Mirin', 50, 'ml', true, 'sonstiges'),
    ('09af25f4-109b-5258-ab4b-a4612ed4adf5', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 7, 'Zucker', 1, 'EL', true, 'trocken'),
    ('6d8621c5-b509-5dc6-ae53-b9e19dd19fc8', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 8, 'Ramen-Nudeln (frisch, Asialaden)', 4, 'Portionen', false, 'trocken'),
    ('8a322f23-3b63-502a-a598-522db11c8a2e', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 9, 'Eier (Ajitsuke Tamago)', 4, 'Stück', true, 'kuehl'),
    ('107bb43e-0e07-5761-a225-79c4497ab507', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 10, 'Chashu oder Rotisserie-Hähnchen-Reste', 200, 'g', false, 'kuehl'),
    ('47f16d5e-8a09-568c-aa99-e2d9d9acbeaf', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 11, 'Nori-Blätter, Bambussprossen, Sesam', null, '', true, 'trocken'),
    ('ded9cdac-8e4d-51de-ae0d-3ea2050e083c', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 12, 'Chili-Öl (Rayu, optional)', null, '', true, 'trocken')
    on conflict (id) do nothing;
  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values
    ('2719c583-8e4a-50ba-a563-71c5c0e62a2c', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 0, null, 'Brühe starten: Knochen in kaltem Wasser aufkochen, 5 min abschäumen, abgießen, Knochen abspülen. (Reinigungsschritt – wichtig!)', 300, false, null, null, null, false, array['ca72e94c-31b4-5f4c-ac20-01b977cfa746', '37dc2f34-4e1d-5368-a716-100996bdc09a']::uuid[]),
    ('0e934d3b-6544-5bb2-ad08-6b6c96e82155', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 1, null, 'Knochen + 2 L frisches Wasser + Ingwer + Knoblauch + Zwiebel + Lauchzwiebel + Kombu aufkochen.', null, false, null, null, null, false, array['ca72e94c-31b4-5f4c-ac20-01b977cfa746', '37dc2f34-4e1d-5368-a716-100996bdc09a', '46c508f6-6a57-5eca-a581-f8b2ee0304dd', 'bf809ec8-3914-5383-ac1d-a4c534c3cbf7']::uuid[]),
    ('55fa4f8a-7c20-57bb-ac93-6264cbcfe3bf', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 2, null, '1,5h bei kleinster Flamme simmern. Kombu nach 30 min rausnehmen (wird sonst bitter).', 18000, false, null, null, null, false, array['46c508f6-6a57-5eca-a581-f8b2ee0304dd']::uuid[]),
    ('5026d1ba-7aee-51ea-a018-3d38deb7d898', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 3, null, 'Letzte 15 min: Katsuobushi reinwerfen. 5 min ziehen lassen. Durch feines Sieb abseihen. Salzen.', 900, false, null, null, null, false, '{}'::uuid[]),
    ('1cf13f8d-d552-5e14-a37b-eab8cc818360', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 4, null, 'Tare: Sojasauce + Mirin + Zucker + Knoblauch + Ingwer 5 min köcheln, abseihen.', 300, false, null, null, null, false, array['bf809ec8-3914-5383-ac1d-a4c534c3cbf7', '0f72e968-3ae7-57c5-a21b-9921b8f26f42', '57b4d2f8-be6f-52a2-a017-5a841192eaeb', '09af25f4-109b-5258-ab4b-a4612ed4adf5']::uuid[]),
    ('99335917-ecaf-585c-a597-4b5b2b11249e', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 5, null, 'Ajitsuke Tamago: Eier 6 min kochen, pellen, über Nacht in Sojasauce + Mirin + Wasser (je 100 ml) einlegen.', null, false, null, null, null, false, array['0f72e968-3ae7-57c5-a21b-9921b8f26f42', '57b4d2f8-be6f-52a2-a017-5a841192eaeb', '8a322f23-3b63-502a-a598-522db11c8a2e']::uuid[]),
    ('3fadae1b-0e5c-5a24-ae7a-620b50adeaa1', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 6, null, 'Anrichten: 3 EL Tare in jede Schüssel. Kochend heiße Brühe drübergießen (ca. 350 ml pro Schale).', null, false, null, null, null, false, '{}'::uuid[]),
    ('797656b9-7d89-5446-a0de-38a13c38bac6', h, '95181b33-4d23-5416-a0b3-cb408dc1222c', 7, null, 'Nudeln separat kochen, abgießen, in die Brühe. Toppings drauf: Chashu-Scheiben, Ei-Hälfte, Lauchzwiebel, Nori, Bambus, Sesam, Chili-Öl.', null, false, null, null, null, false, array['bf809ec8-3914-5383-ac1d-a4c534c3cbf7', '6d8621c5-b509-5dc6-ae53-b9e19dd19fc8', '8a322f23-3b63-502a-a598-522db11c8a2e', '107bb43e-0e07-5761-a225-79c4497ab507', '47f16d5e-8a09-568c-aa99-e2d9d9acbeaf', 'ded9cdac-8e4d-51de-ae0d-3ea2050e083c']::uuid[])
    on conflict (id) do nothing;

end $$;
