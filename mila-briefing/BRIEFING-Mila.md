# Briefing: Mila als Bereich in Casa

Hallo Claude Code. Du baust **Mila** neu – den Essensplaner der Familie – als eigenen Bereich innerhalb der bestehenden **Casa**-App (Max und Anna, Supabase, beide eingeloggt).

Max ist kein Entwickler. Erklär Entscheidungen kurz und verständlich, frag ihn **bevor** du Datenbank-Migrationen ausführst oder an bestehenden Casa-Screens etwas änderst.

---

## 1. Ziel in einem Satz

Ein ruhiger Kreislauf **planen → einkaufen → kochen**, der sich nahtlos in Casa einfügt. Nicht mehr. Die alte Mila wurde nie genutzt, weil sie überladen war – **Schlankheit ist die wichtigste Anforderung.**

## 2. Grundregeln

- **Casa bleibt schlank.** Einziger Eingriff in Casa: ein Symbol (Topf-Icon), über das man in den Mila-Bereich kommt. Keine weiteren Änderungen an bestehenden Casa-Screens.
- **Gleiches Fundament:** gleiche Supabase-Datenbank, gleicher Login, gleiche Rechte (nur Max und Anna), gleiche Design-Sprache und – wenn vorhanden – gleiche Komponenten/Tokens wie Casa.
- **Zuerst Casa-Repo anschauen:** Stack, Ordnerstruktur, Routing, Auth, bestehende Tabellen, Design-Tokens, Dark-Mode-Logik. Dann einen kurzen Plan vorlegen, bevor du baust.
- Bau in den Schritten aus Abschnitt 8, jeder Schritt einzeln lauffähig und committet.

## 3. Was in Phase 1 gebaut wird

Mila hat drei Reiter unten (**Woche · Liste · Gerichte**) plus den Kochmodus. Oben links ein „‹ Casa"-Link zurück.

### 3.1 Woche
- Wochenansicht Mo–So, mit Blättern zwischen Wochen (KW + Datumsbereich im Kopf).
- **Pro Tag ein Abendessen.** Kein Mittag in Phase 1.
- Jeder Tag zeigt: Wochentag + Datum, Rhythmus-Label, Gericht (oder „noch offen · Vorschlag?"), Dauer, „TM"-Badge bei Thermomix-Gerichten.
- **Standard-Rhythmus** (als sanfte Vorgabe, im Code als Konstante): Mo Kochtag · Di Aus Prep · Mi Frisch · Do Aus Prep · Fr Frisch · Sa Grill · So Frei.
- Tag antippen → klappt auf (sanfte Animation):
  - „Tauschen gegen" mit 2–3 passenden Vorschlägen aus dem Fundus (passend zur Kategorie des Rhythmus), ein Tipp tauscht.
  - Alle Gerichte durchsuchen / auswählen.
  - Alternativ **Freitext** statt Rezept (z. B. „Rigatoni mit Bolognese aus Prep") – Freitext-Tage erzeugen keine Einkaufszutaten.
  - „Rezept ansehen ›".
- Unten fixierter Knopf **„Zutaten auf die Liste"** mit Anzahl:
  - Nimmt die Zutaten aller Rezept-Tage der Woche, **ohne Basics** (`pantry_basic`), fasst gleiche Zutat + Einheit zusammen (Mengen addieren).
  - Jede Zutat bekommt eine Herkunft („Mo · Bolognese", bei mehreren „Mi + Do").
  - Kein doppeltes Hinzufügen: Was aus dieser Woche schon auf der Liste steht, wird nicht noch einmal eingefügt.
  - Danach wird der Knopf zur Bestätigung „19 Zutaten auf der Liste · ansehen ›".

### 3.2 Liste (Einkaufsliste)
- **Live geteilt** zwischen Max und Anna (Supabase Realtime). Im Kopf: „Einkauf", Anzahl offen, zwei Initialen-Kreise M/A + „live geteilt".
- Eingabefeld „Was fehlt noch?" für freie Einträge.
- Gruppiert nach Abteilung in fester Reihenfolge: **Obst & Gemüse · Kühlregal · Trocken & Vorrat · Getränke · Sonstiges**. Kategorie automatisch per Stichwort-Regeln (die Regeln aus der alten Mila übernehmen, `src/lib/shopping.js`), bei freien Einträgen ebenso.
- Jede Zeile: Kreis zum Abhaken, Name (Handschrift-Font), Menge, Herkunft. Einträge von Anna sind als „Anna" markiert (goldene Schrift), von Max entsprechend.
- Abhaken → kleine Häkchen-Animation, Eintrag rutscht in einen einklappbaren Bereich **„Im Wagen · n"** (durchgestrichen, gedimmt). Nochmal antippen holt ihn zurück.
- Knopf „Einkauf abschließen" entfernt alles Abgehakte.

### 3.3 Gerichte (Fundus)
- Kopf „Unsere Gerichte", Anzahl.
- Filter-Chips: **Alle · Schnell · Thermomix · Meal-Prep · Grill**.
- Kachel-Raster (2 Spalten): oben eine ruhige Platzhalter-Kachel je Typ (Thermomix-Topf, Pfanne, Schüssel, Grill – als dünnes Linien-Icon auf getönter Fläche), darunter Name + „25 Min · Thermomix".
- **Keine Fotos in Phase 1.** Das Datenmodell hat aber ein Feld `image_url` (leer), weil später Illustrationen/Animationen pro Gericht kommen (werden extern gemacht).
- Gestrichelte Karte „Neues Rezept" → in Phase 1 ein schlichtes Formular (Name, Dauer, Portionen, Kategorie, Geräte, Zutaten, Schritte inkl. Thermomix-Feldern). Der Import per Foto/Link über Claude kommt in Phase 2.

### 3.4 Gericht (Detail)
- „‹ Gerichte", Platzhalter-Kachel, Name groß (Handschrift), Meta: Dauer, TM-Badge, Kategorie, „Valerie-tauglich".
- **Portionen −/+** mit Live-Umrechnung aller Mengen (sinnvoll runden: g/ml auf 10er ab 100, Stück auf halbe, ½ als Zeichen).
- Zutatenliste (Menge rechtsbündig, Name in Handschrift).
- „Für Valerie"-Notiz als leicht schräger Notizzettel (wenn vorhanden).
- Unten: „In die Woche" (Tag wählen) und großer Knopf **„▶ Kochen"**.

### 3.5 Kochmodus
- **Vollbild, dunkles Navy**, helle Schrift. Bildschirm bleibt an (Screen Wake Lock API), kleiner Hinweis „bleibt an".
- Oben: ✕ schließen, Gerichtname, Fortschritt als Segmentbalken (ein Segment je Schritt).
- Ein Schritt pro Seite: große Schrittnummer (Handschrift, Gold), Schritttext groß (~27 px).
- „Brauchst du jetzt": Chips mit den Zutaten dieses Schritts – **mit der umgerechneten Menge** aus der Portionswahl.
- **Timer** im Schritt, wenn der Schritt eine Dauer hat: Ring-Fortschritt + mm:ss, antippen startet/pausiert, am Ende sanfter Ton + Vibration (wo möglich).
- Weiter per Knopf oder **Wischen**; Übergang als sanftes Hineingleiten von rechts (zurück: von links), ~0,45 s, ruhig statt verspielt.
- Letzter Schritt: goldener Knopf „Fertig · guten Appetit".

### 3.6 Kochmodus – Thermomix-Schritte (wie Cookidoo)
- Schritt-Titel (z. B. „Andünsten") neben der Nummer.
- Drei große Kacheln nebeneinander: **Zeit · Temperatur · Stufe**. Bei Linkslauf ein Linkslauf-Symbol neben der Stufe (dreht sich langsam, während der Timer läuft).
- Zeit-Kachel antippen → Countdown startet, Kachel bekommt goldenen Rand, Fortschrittsbalken unten in der Kachel.
- Zutaten-Chips mit Überschrift „In den Mixtopf · Waage auf null".
- Kurzer Hinweis darunter: „Am Thermomix einstellen – oder auf die Zeit tippen, dann läuft der Countdown hier mit."
- Normale Schritte und TM-Schritte dürfen im selben Rezept gemischt sein.

## 4. Design

Exakt der Casa-Look. Falls Casa bereits Tokens/Komponenten hat, **diese verwenden**. Referenzwerte:

- Hintergrund Papier `#F4F1EA` mit feinem Punktraster, gestrichelte Randlinie links (wie Casa)
- Navy `#1F2A44` (Primär, Kochmodus-Hintergrund)
- Gold `#B08A45`, dunkles Gold `#6B5222` (Text), helles Gold `#D9B877` (auf Navy)
- Text `#1D1D1B`, gedämpft `#6E6A60`, Karten `#FBF9F4`, Notizzettel `#EFE4C8`
- Schriften: **Newsreader** (Text) + **Caveat** (Handschrift für Gerichte, Zutaten, Überschriften)
- Kleine Labels: Großbuchstaben, 10–12 px, weite Laufweite
- Untere Navigation wie Casa: drei Labels, aktives mit goldenem Unterstrich
- Dark Mode abends wie in Casa
- Touch-Flächen mindestens 44 px, keine Emojis, keine bunten Verläufe

Im Ordner `design/` liegen die sechs Mockups als HTML (`Main` = Woche, `Liste`, `Gerichte`, `Gericht`, `Kochen`, `Thermomix`). Sie laufen nicht eigenständig – nutze sie als **Referenz für Layout, Abstände, Texte, Farben und Animationen**.

## 5. Datenmodell (Vorschlag, an Casa-Konventionen anpassen)

- `mila_recipes`: id, name, category (`schnell`/`mealprep`/`wochenende`/`grill`/`fruehstueck`), time_min, portions, valerie_tauglich, devices (text[]), notes, valerie_note, image_url (null), created_by, created_at, updated_at
- `mila_ingredients`: id, recipe_id, position, name, amount (numeric, null erlaubt), unit, pantry_basic, shop_category
- `mila_steps`: id, recipe_id, position, title (optional), text, timer_sec (optional), is_thermomix, tm_time_sec, tm_temp (Text: z. B. `120`, `Varoma`, leer), tm_speed (Text: z. B. `1`, `5`, `Löffel`), tm_reverse (bool), ingredient_ids (Zutaten dieses Schritts)
- `mila_week_days`: id, date (unique), recipe_id (null), free_text (null), added_to_list (bool)
- `mila_shopping_items`: id, name, amount (Text), category, source_label, source_week, added_by, checked, checked_by, checked_at, created_at
- RLS wie bei Casa: nur Max und Anna lesen/schreiben. Realtime für `mila_shopping_items` (und gern `mila_week_days`).

## 6. Rezepte umziehen

- Quelle: öffentliches Repo `MaxsLobster/mila-app`, Datei `src/db/seed.js` (30 Rezepte).
- Mengen in Zahl + Einheit zerlegen, wo möglich (`'1/2'` → 0,5; leere Mengen bleiben leer).
- **Thermomix-Schritte aus dem Fließtext in feste Felder umwandeln**, z. B. „5 min / 120°C / Stufe 1" → Zeit 300 s, Temp 120, Stufe 1; „Linkslauf" → tm_reverse; „Varoma" als Temperatur; „Sek" beachten. Normale Schritte mit Zeitangabe („8 min anbraten") bekommen `timer_sec`.
- Zu jedem Schritt die passenden Zutaten verknüpfen, soweit eindeutig.
- Die Valerie-Hinweise aus `notes` in `valerie_note` übernehmen.
- **Danach Max eine kurze Liste zeigen**, bei welchen Rezepten/Schritten die Umwandlung unsicher war.

## 7. Bewusst NICHT in Phase 1

Vorrat, Freezer-Cube-Bank, Plan B, Ablaufdaten, Mittagessen, Fotos/Illustrationen, Rezept-Import per Claude, Push-Mitteilungen, eine Mila-Zeile auf der Casa-Startseite. Nichts davon „schon mal vorbereiten" – außer dem leeren Feld `image_url`.

## 8. Reihenfolge

1. Casa-Repo verstehen, Plan + Tabellen vorschlagen → **Max bestätigt**
2. Tabellen + Rezept-Umzug, Liste der unsicheren Umwandlungen an Max
3. Einstieg in Casa (Symbol) + Mila-Gerüst mit drei Reitern
4. Liste (inkl. Realtime) – mit Anna testbar
5. Gerichte + Gericht-Detail
6. Woche + „Zutaten auf die Liste"
7. Kochmodus + Thermomix-Schritte
8. Deploy wie Casa, kurzer Checkpoint an Max: was fertig ist, was offen ist

## 9. Fertig ist es, wenn …

- Max plant auf dem iPhone eine Woche, drückt „Zutaten auf die Liste", und Anna sieht die Liste auf ihrem Handy sofort.
- Beide können im Laden abhaken, und der andere sieht es live.
- Die Bolognese-Basis lässt sich im Kochmodus Schritt für Schritt kochen, mit Thermomix-Kacheln und laufendem Countdown, ohne dass der Bildschirm ausgeht.
- Casa sieht außer dem neuen Symbol genauso aus wie vorher.
