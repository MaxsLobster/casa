# Plan · Mila Wochenkarte

## Was es heute gibt
- 30 Gerichte im Fundus, alle mit Zutaten und Kochschritten. Kategorien: Schnell (14), Meal-Prep (8), Wochenende (5), Grill (2), Frühstück (1).
- Zutaten haben schon Menge, Einheit, Ladengang (5 Gänge) und „Basic“ (= meist Vorrat).
- Die Woche kennt bisher nur ein Abendessen pro Tag. Noch nichts eingetragen.

## Optik
- Ich behalte den bestehenden Mila-Look (Papier, Kopf „‹ Casa · Mila“). Der olivgrüne Einband wäre ein dritter Stil neben Casa und dem Navy der MWF. Oliv nur als kleiner Akzent (Joker, Treffer-Marken).
- Leiste unten wie in der Vorlage: **Woche · Karte · Einkauf · Prep**. „Alle Gerichte“ wird ein Link oben in der Woche.

## Datenmodell (eine Migration)

**Gerichte (`mila_recipes`), neue Felder**
| Feld | Bedeutung | Standard für den Fundus |
|---|---|---|
| `meal` | mittag · abend · beides | Schnell, Meal-Prep → beides; Wochenende, Grill → abend; Frühstück kommt nie auf die Karte |
| `label` | Kartenkategorie, freier Text (Familie, Vegetarisch, Leicht, Saison …) | leer → aus der alten Kategorie („Schnell“, „Grill / BGE“ …) |
| `blurb` | ein Satz für die Karte | leer → erster Satz der Notiz |
| `valerie_mag` | „Valerie mag’s“ | aus (das bisherige „Valerie-tauglich“ steht bei allen 30 an und sagt nichts) |
| `cook_double` | „doppelt → Mittag“ | Meal-Prep an, sonst aus |
| `prep_box` | „Prep-Box“, komplett vorbereitbar | aus |

**Prep-Schritte (neue Tabelle `mila_prep_steps`)**: Gericht, Reihenfolge, Text, Dauer (Min), läuft nebenbei, Box-Etikett, erst am Vortag.

**Woche (`mila_week_days`)**: neu `meal` (mittag · abend), `leftover_of` (Reste von welchem Abend), `servings` (Portionen). Eindeutig pro Tag **und** Mahlzeit.

**Wochenkarte (neue Tabelle `mila_menus`)**, eine Zeile pro Woche: Woche (Montag), Abendkarte und Mittagskarte (Gericht-Listen), offen ab, schließt um, aufgedeckt am, übernommen am/von, erledigte Prep-Schritte.

**Stimmen (neue Tabelle `mila_votes`)**: Karte, Person, Gericht, Mahlzeit, Stimme (nein · ja · joker).
- **Anonym in der Datenbank**: Jeder darf nur die eigenen Stimmen lesen, bis die Karte aufgedeckt ist. Ob der andere fertig ist, liefert eine kleine Funktion, die nur zählt.

**Einstellungen (neue Tabelle `mila_settings`)**, eine Zeile pro Haushalt: Mittagessen pro Woche (3), Abendessen (3), Karte ab Fr 18:00, Wahl schließt Sa 12:00, Einkaufstag Sa, Prep So 17:00.

**Einkauf (`mila_shopping_items`)**: neu `is_stock` (grau, „haben wir schon“).

## Ablauf
1. **Karte entsteht**: Sobald jemand nach Fr 18 Uhr Mila öffnet, entsteht die Karte für die nächste Woche (nur einmal). Bis zu 8 Gerichte je Karte: etwa 3 Lieblinge (oft gewählt oder gegessen), 3 lange nicht gegessen, 1–2 neu oder selten. Nichts aus der Vorwoche. Ein „beides“-Gericht steht nur auf einer der beiden Karten.
2. **Wählen**: Zettel wie in der Vorlage, Wischen links ✕ · rechts ✓ · hoch ★, dazu Knöpfe. Ein Joker pro Karte. Danach „Fertig gewählt · Anna wählt noch …“.
3. **Aufdeckung**, sobald beide fertig sind oder Sa 12 Uhr vorbei ist. Hat nur einer gewählt, zählt nur seine Wahl. „5 Treffer!“ mit kleiner Animation.
4. **Treffer und Verteilung** (wird beim Öffnen berechnet, Würfeln fest pro Woche, damit beide dasselbe sehen):
   - Treffer = beide ✓ oder ★, Joker immer. Zu wenige: auffüllen nach Punkten (★ 2, ✓ 1), Gleichstand würfeln. Zu viele: Reserve.
   - Tage, an denen ihr beide weg seid (Ereignis, Messe), fallen raus.
   - Abendessen auf die ersten freien Abende, „doppelt“-Gerichte bevorzugt dort, wo am nächsten Tag ein Mittag frei ist. Wer kocht, kommt aus der Normalwoche; offener Slot zeigt „übernehmen“.
   - Reste am nächsten Mittag automatisch, restliche Mittage aus der Mittagskarte.
   - Portionen: Abend = anwesende Erwachsene + Valerie (wenn nicht weg). Mittag = anwesende Erwachsene. „Doppelt“ kocht die Mittagsportionen gleich mit.
   - Reihenfolge per Ziehen änderbar. **„Woche übernehmen“** kann jeder von euch drücken.
5. **Beim Übernehmen** entstehen auf einmal: die Woche, der Einkaufszettel, der Prep-Plan und Aufgaben für „erst am Vortag“ (beim Koch des Abends, ohne Mitteilung).

## Einkaufszettel
- Mengen umgerechnet auf die Portionen, zusammengefasst, nach Ladengang sortiert. Kopf „Großer Einkauf · Sa · 6 Mahlzeiten · 3 Personen“.
- Vorrat steht grau abgehakt, Antippen setzt ihn doch auf die Liste. Eigene Zeilen wie bisher, live für beide.
- Wird die Woche neu übernommen, ersetzt das die offenen Zeilen dieser Woche.

## Prep-Stunde
- Schritte der Woche: lange und „nebenbei“-Schritte zuerst, Gesamtdauer oben, abhaken live für beide.
- Boxen mit Klebeband-Etikett „Tag · Gericht“.
- **Standard, solange der Fundus keine Prep-Schritte hat**: Jedes Mittagessen aus der Karte (nicht Reste) bekommt automatisch „komplett vorkochen, in die Box“ mit seiner Dauer und eine Box. Abendessen nur, wenn „Prep-Box“ an ist. So ist die Prep-Stunde nie leer.
- In der Casa-Woche: Termin „Prep-Stunde“ So 17:00 für beide (abgeleitet, nicht gespeichert, wie die Messetage). Antippen öffnet den Prep-Plan.

## In Casa
- Heute: „Du kochst: Hähnchen-Curry · 35 Min“, „Mittag: Couscous-Bowl · aus der Box“ bzw. „Reste vom Curry“. Antippen öffnet den Kochmodus.
- Woche-Details: Gericht beim Abend und beim Mittag.

## Fundus bearbeiten
- Im Rezeptformular neu: Mahlzeit, Kartenkategorie, ein Satz, die drei Merkmale und die Prep-Schritte. „Zuletzt gegessen“ rechnet Mila selbst aus der Woche.

## Einstellungen
- In den Casa-Einstellungen ein Abschnitt „Mila“: Anzahl Mittag und Abend, Karte ab, Wahl schließt, Einkaufstag, Prep-Zeit.

## Mitteilungen
- Fr 18 Uhr „Die Wochenkarte ist da“ an alle mit eingeschalteten Mitteilungen (Ruhezeiten gelten).
- Beim Übernehmen: „6 Mahlzeiten stehen · Einkaufszettel ist fertig“ an den anderen.
- Sonst nichts.

## Annahmen, von Max bestätigt (6.11.2026)
1. **Übernehmen** per Knopf „Woche übernehmen“. Hat bis **Samstag 14 Uhr** niemand gedrückt, übernimmt Mila automatisch (Einkaufszettel + Mitteilung). Läuft auf dem Server (Edge Function `mila-tick`, minütlich angestoßen von `public.mila_tick()`), auch wenn niemand die App öffnet. Zeit in den Einstellungen änderbar.
2. **Wochenende** gehört nicht zur Karte.
3. **Valerie mittags** isst nicht mit, außer an Tagen mit „Kita zu“ (Ferien): dann eine Mittagsportion mehr.
4. Ladengänge bleiben die bisherigen fünf.
5. Die alte Wochen-Ansicht „Kochtag / Aus Prep / Frisch“ fällt weg.

Zusätzlich beim Bauen: Abende, an denen laut Normalwoche auswärts gegessen wird (z. B. „bei Freunden“), bekommen kein Abendessen.
