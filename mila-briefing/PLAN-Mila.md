# Mila in Casa · Plan (Schritt 1)

Stand 31.10.2026. Noch nichts gebaut, keine Datenbank angefasst. Das hier ist der Vorschlag, den du bestätigst oder änderst.

---

## 1. Was ich in Casa vorgefunden habe

- **Stack:** Vite 7, React 19, TypeScript, HashRouter (Adressen wie `#/heute`), PWA, Deploy per GitHub Actions auf https://maxslobster.github.io/casa/. Supabase-Projekt `qndejfhlemqiobatlgkf`, sechs Migrationen, alle eingespielt.
- **Login und Rechte:** Tabelle `members` (Max, Anna) hängt an `households`. Jede Tabelle hat `household_id`, die RLS-Regel ist überall gleich: „nur mein Haushalt“ über die Funktion `my_household_ids()`. Rechte werden pro Tabelle ausdrücklich vergeben (automatisches Freischalten ist im Projekt aus).
- **Datenzugriff:** Eine kleine Schicht `Store` mit zwei Ausführungen: `SupabaseStore` (echt) und `LocalStore` (Demo-Modus im Browser, ohne Zugangsdaten). Live-Änderungen laufen über `store.onChange(...)` (Supabase Realtime). Das passt für Mila eins zu eins.
- **Design:** Alle Farben sind CSS-Variablen in `global.css` (`--paper`, `--navy`, `--gold`, `--brown`, `--note`, `--line` …) mit Dunkel-Variante ab 20 Uhr. Schriften Newsreader + Caveat sind schon da. Fertige Klassen: `.page`, `.nav`, `.h1`, `.kicker`, `.label`, `.hand`, `.hint`, `.chip`, `.btn`, `.note`, `.check`, `.collapse`, `.tabs`. Papier-Look mit Löchern, Punktraster und gestrichelter Perforation links kommt automatisch, weil er auf `html`/`body` liegt.
- **Mockups:** Die sechs HTML-Dateien nutzen fast dieselben Werte wie Casa (Papier `#F4F1EA` statt `#F5F1E8`, Navy `#1F2A44`, Gold `#B08A45`). Ich nehme die Casa-Variablen, nicht die Mockup-Hexwerte, damit Mila im Dunkelmodus mitgeht.

**Fazit:** Mila lässt sich als eigener Bereich anhängen, ohne dass Casa-Screens, Casa-Daten oder Casa-Laden angefasst werden.

---

## 2. Wie Mila in Casa sitzt

- **Adressen:** `#/mila/woche`, `#/mila/liste`, `#/mila/gerichte`, `#/mila/gerichte/<id>`, `#/mila/kochen/<id>`. Alles unter `#/mila/…` zeigt Mila, alles andere bleibt Casa.
- **Einstieg (der einzige Eingriff in Casa):** Ein dünnes Topf-Symbol oben rechts auf **Heute**, direkt neben dem Zahnrad (44 px Touchfläche). Mehr nicht. Der untere Casa-Reiter bleibt unverändert, dort wäre ein sechstes Element zu eng.
- **Zurück:** Oben links in Mila „‹ Casa“ führt zu `#/heute`.
- **Eigene Leiste:** Mila hat unten die drei Reiter Woche · Liste · Gerichte im selben Stil wie die Casa-Leiste (Großbuchstaben, aktiver Reiter mit goldenem Unterstrich), kein Plus-Knopf.
- **Eigener Daten-Kontext:** `MilaProvider` lädt Rezepte, Zutaten, Schritte, Wochentage und Liste nur, wenn man in Mila ist. Casa lädt davon nichts, also wird Casa nicht langsamer. Realtime für Liste und Woche über denselben `store.onChange`-Weg wie in Casa.
- **Demo-Modus:** Mila funktioniert auch ohne Zugangsdaten im Browser (mit den 30 Rezepten), so kann ich jeden Schritt hier prüfen. Nur das Live-Teilen mit Anna braucht die echte Datenbank.
- **Dateien:** `src/mila/` (Screens, Kontext, Hilfsfunktionen, eigene `mila.css`), Typen in `types.ts` ergänzt, Routen in `App.tsx` ergänzt.

---

## 3. Tabellen (an Casa angepasst)

Alle fünf bekommen `household_id`, dieselbe RLS-Regel wie Casa, Rechte für `authenticated`, `updated_at`-Trigger, wo sinnvoll `created_by`/`updated_by` (Verweis auf `members`). Präfix `mila_`.

**`mila_recipes`** · ein Gericht
id · household_id · name · category (`schnell` / `mealprep` / `wochenende` / `grill` / `fruehstueck`) · time_min · portions · valerie_tauglich · devices (Liste: `thermomix`, `pfanne`, `topf`, `wok`, `ofen`, `plancha`, `bge`, `dutch_oven`) · notes · valerie_note · image_url (leer, für später) · created_by · created_at · updated_at

**`mila_ingredients`** · eine Zutat eines Gerichts
id · recipe_id · position · name · amount (Zahl, darf leer sein) · unit · pantry_basic · shop_category (`obst_gemuese` / `kuehl` / `trocken` / `getraenke` / `sonstiges`, beim Umzug per Stichwort-Regeln gesetzt)

**`mila_steps`** · ein Schritt eines Gerichts
id · recipe_id · position · title (optional, z. B. „Andünsten“) · text · timer_sec (optional) · is_thermomix · tm_time_sec · tm_temp (Text: `120`, `Varoma`, leer) · tm_speed (Text: `1`, `5`, `Löffel`) · tm_reverse · ingredient_ids (Liste der Zutaten dieses Schritts)

**`mila_week_days`** · ein Abendessen an einem Datum
id · household_id · date (pro Haushalt nur einmal) · recipe_id (leer erlaubt) · free_text (leer erlaubt) · added_to_list · created_by · updated_by · created_at · updated_at

**`mila_shopping_items`** · ein Eintrag auf der Einkaufsliste
id · household_id · name · amount (Text, z. B. „2 Stück“) · category · source_label („Mo · Bolognese“, „Mi + Do“ oder leer bei freien Einträgen) · source_week (z. B. `2026-W45`, damit nichts doppelt hinzukommt) · source_recipe_ids (für „nicht doppelt“) · added_by · checked · checked_by · checked_at · created_at

**Realtime:** `mila_shopping_items` und `mila_week_days`.
**Keine** Trigger für Mitteilungen, keine Verknüpfung mit Casa-Terminen oder -Aufgaben.

Zwei kleine Abweichungen vom Briefing-Vorschlag, beide nur, damit es zu Casa passt: überall `household_id` (sonst greift die RLS-Regel nicht), und bei der Liste zusätzlich `source_recipe_ids`, damit „kein doppeltes Hinzufügen“ sauber geht, wenn du eine Woche änderst und nochmal drückst.

---

## 4. Rezept-Umzug (Schritt 2)

- Quelle: `MaxsLobster/mila-app`, `src/db/seed.js`, 30 Rezepte (schon heruntergeladen und angeschaut).
- Ein Skript `scripts/mila-import.mjs` liest die Datei und erzeugt daraus eine Migration mit den Daten und eine JSON-Datei für den Demo-Modus. Das Skript läuft nur bei mir, nicht in der App.
- **Mengen:** `'1/2'` → 0,5; `'8-10'` → 8 und `'1-3'` → 1 (unsicher, kommt auf die Liste für dich); Einheiten wie „als Beilage“, „nach Geschmack“, „zum Dippen“ bleiben als Einheit stehen, Menge leer.
- **Thermomix-Schritte** (8 Stück, alle in Bolognese-Basis, Hummus-Bowl, Overnight Oats): Muster wie „5 min / 120°C / Linkslauf / Stufe 1“ → tm_time_sec 300, tm_temp 120, tm_reverse, tm_speed 1. „Sek“ wird erkannt, „Varoma“ als Temperatur. Der Text davor („Olivenöl dazu“) bleibt der Schritttext, das Verb danach („andünsten“) wird der Titel.
- **Normale Schritte mit Zeit** („8 min anbraten“): die erste Zeitangabe wird `timer_sec`. Bei Bereichen („5–7 min“) nehme ich den kleineren Wert und markiere den Schritt als unsicher. „1h 15 min“ wird erkannt. Marinierzeiten („mind. 20 min, besser 2h“) bekommen keinen Timer, stehen aber auf der Liste.
- **Zutaten je Schritt:** per Namensabgleich (Wortstamm im Schritttext), nur wenn eindeutig. Alles andere steht auf der Liste.
- **Valerie:** der Absatz nach „Valerie:“ in `notes` wird `valerie_note`, der Rest bleibt `notes`.
- Danach bekommst du die Liste der unsicheren Stellen, bevor es weitergeht.

---

## 5. Entscheidungen, die ich treffe (sag Bescheid, wenn du es anders willst)

- **Rhythmus** als Konstante: Mo Kochtag (Vorschläge: Meal-Prep) · Di Aus Prep (Vorschläge: Meal-Prep, gedacht für Freitext wie „Rigatoni mit Bolognese aus Prep“) · Mi Frisch (Schnell) · Do Aus Prep · Fr Frisch (Schnell) · Sa Grill (Grill, sonst Wochenende) · So Frei (keine Vorschläge, Freitext).
- **Gerichte-Filter:** Alle · Schnell · Thermomix · Meal-Prep · Grill. Overnight Oats (Frühstück) erscheint nur unter „Alle“.
- **Bildschirm an im Kochmodus:** Screen Wake Lock, geht auf dem iPhone ab iOS 16.4 vom Home-Bildschirm aus.
- **Kochmodus-Farben:** fest Navy mit heller Schrift, auch tagsüber (so im Briefing).

---

## 6. Reihenfolge ab jetzt

1. ✅ Dieser Plan → **du bestätigst**
2. Migration für die fünf Tabellen + Rezept-Umzug → **du gibst das Einspielen frei**, dann Liste der unsicheren Umwandlungen
3. Topf-Symbol auf Heute + Mila-Gerüst mit drei Reitern und „‹ Casa“
4. Liste mit Realtime (mit Anna testbar)
5. Gerichte + Gericht-Detail (mit Portionen-Umrechnung, Formular „Neues Rezept“)
6. Woche + „Zutaten auf die Liste“
7. Kochmodus + Thermomix-Schritte
8. Deploy, Checkpoint

Jeder Schritt ein Commit, jeder für sich lauffähig. Nach jedem Schritt eine kurze Nachricht an dich.

---

## 7. Was ich von dir brauche

1. **Passt der Plan?** Insbesondere: Topf-Symbol oben rechts auf Heute neben dem Zahnrad.
2. **Passen die Tabellen?** Dann schreibe ich die Migration (Schritt 2) und frage vor dem Einspielen nochmal.
