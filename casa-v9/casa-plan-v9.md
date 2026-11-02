# Casa v9 · Plan: Bereich Munich Watch Fair

Stand 2.11.2026. Vorlagen `casa-v9/design-referenz-v9/` nur für die Optik.

## 0. Messetermine (bitte bestätigen)

Auf `main` des Website-Repos stehen nur Februar bis Juni 2026. Die vollständige Liste liegt im Branch `feature/fillout-termine-cleanup` (js/main.js), und die Live-Seite zeigt als nächsten Termin den 8.11.2026. Das passt zusammen. Ich übernehme diese zwölf Termine, alle Sonntag, Ballhausforum Unterschleißheim:

| 2026 | 2027 |
|---|---|
| So 4.10. (vorbei) | So 17.1. |
| **So 8.11. (nächste)** | So 21.2. |
| So 6.12. | So 4.4. |
| | So 16.5. |
| | So 27.6. |
| | So 5.9. |
| | So 17.10. |
| | So 14.11. |
| | So 12.12. |

Die Termine von Februar bis Juni 2026 lasse ich weg (vorbei, keine Runde dazu). Die aktuelle Runde läuft seit Mo 5.10.2026 (Montag nach dem 4.10.) bis So 8.11.2026.

## 1. Datenmodell

**Bestehende Tabellen bekommen ein Feld „Bereich“**
- `tasks.area` und `anchors.area`: `casa` | `mwf`, alles Bestehende = `casa`.
- `tasks` zusätzlich: `fair_id` (gehört zur Runde dieser Messe), `template_id` (aus welcher Vorlagenzeile erzeugt), `is_running` (laufend: kein Abhaken, gestrichelter Kreis, endet am Messetag), `is_yearly` (Jahres-Checkliste).
- `settings` zusätzlich: `workday_on` (Datum, an dem „Arbeitstag“ an ist, sonst leer – dadurch ist er um Mitternacht automatisch aus) und `mwf_notify`: `aus` | `briefing` | `sofort`, Standard `aus`.

**Neue Tabellen**
- `fairs`: Messe mit `date` (einmalig pro Haushalt) und `note`.
- `checklist_template`: eine Zeile je Vorlagenpunkt: `title`, `owner_member_id` (leer = beide), `section` (`start` Ab Montag nach der letzten Messe · `until` Bis zur Messe · `before` X Tage vorher · `eve` Tag davor · `fair` Messetag), `days_before` (Tage vor der Messe; leer = Freitag der Startwoche), `is_running`, `sort`. In der App bearbeitbar (Titel, wer, Abschnitt, Fälligkeit, laufend, Reihenfolge, entfernen, neu).
- `ideas`: Ideen-Parkplatz, `area`, `text`, Ersteller. Ohne Besitzer, ohne Datum. „Zur Aufgabe machen“ oder „Zum Anker machen“ legt das Neue an und löscht die Idee.

**Rechte**: wie bisher pro Haushalt. `checklist_template`, `fairs`, `ideas` am Realtime-Kanal.

**Keine Aussteller-Daten**: keine Tabelle, kein Feld, kein Import. Nur Termine und eure eigenen Aufgaben.

## 2. Die Runde

- Runde einer Messe = Montag nach der vorigen Messe bis zum Messetag. Erste Runde ohne Vorgänger: Montag sechs Wochen davor.
- Aus der Vorlage werden echte Aufgaben erzeugt (Bereich mwf, `fair_id`, `template_id`, berechnetes Datum): Freitag der Startwoche, „N Tage vor der Messe“, Tag davor = 1, Messetag = 0, laufend = Messetag.
- **Automatisch**: Die App legt beim Öffnen die fehlenden Aufgaben der laufenden Runde an (idempotent: pro Vorlagenzeile und Messe höchstens eine Aufgabe). Dazu ein täglicher Cron-Lauf um 4 Uhr in der Datenbank, der dasselbe tut, auch wenn niemand die App öffnet. Erzeugte Aufgaben lösen keine Mitteilung aus.
- Ändert man die Vorlage mitten in der Runde, bekommt die laufende Runde neue Zeilen dazu; bestehende Aufgaben bleiben wie sie sind.
- Erste echte Runde (Messe 8.11.): Die Aufgaben mit Datum in der Vergangenheit (Freitag 9.10., 25.10., 27.10., 29.10.) erscheinen als offen. Was schon erledigt ist, hakt ihr einfach ab.
- „beide“ in der Vorlage = Aufgabe ohne Besitzer: beide sehen sie in Hub und Checkliste, in To-Dos als „übernehmen“-Chip.

## 3. Bereich MWF (Routen `/mwf/…`, eigene Leiste)

- **Zugang**: kleines Uhren-Symbol mit „MWF“ ganz unten im Casa-Tab „Anker“. Bei Arbeitstag an zusätzlich oben auf der Startseite neben Mila.
- **Einband**: Navy mit Körnung, unten gestanzte Kante, oben „‹ Casa“ und Schalter „Arbeitstag“. Die iOS-Statusleiste wird im Bereich ebenfalls navy.
- **Leiste**: Hub · Checkliste · + · To-Dos · Anker, fünf gleich breite Felder, + exakt mittig.
- **Hub**: nächste Messe in Handschrift + „noch X Tage“ (am Messetag „heute“), Fortschritt der ganzen Runde (laufende Punkte zählen nicht mit), „Für dich“ mit meinen offenen MWF-Aufgaben bis zur Messe (Rundenpunkte, normale MWF-To-Dos, Jahrespunkte der nächsten 30 Tage), eine Zeile „n erledigt diese Runde“, unten meine angehefteten Firmen-Anker als Etiketten.
- **Checkliste**: Zeitleiste wie in der Vorlage (Linie bis heute durchgezogen, danach gestrichelt; Datum links; Abschnitte; Heute-Marker braun; Messe als goldener Stern; meine Punkte groß in Handschrift, die des anderen klein grau mit Namen; „▸ n erledigt“ eingeklappt; Ende mit Querstrich und „Runde abgeschlossen. Ab Mo … startet die nächste.“). Kreis = abhaken, Text = bearbeiten. „Nur meine / Alle zeigen“ im Einband. Pfeile und Wischen für vorherige/nächste Runde; eine Runde, die noch nicht begonnen hat, zeigt die Vorlage als Vorschau. Unten „Vorlage bearbeiten“ und Abschnitt „Jahr“ (Jahrespunkte mit Kreis, „+ Jahrespunkt“).
- **To-Dos**: dieselbe Seite wie in Casa, nur Bereich mwf, dazu oben Gruppe „Ideen“. + im Bereich: Aufgabe · Idee · Termin, Bereich mwf vorausgewählt.
- **Anker**: dieselben Seiten wie v8 (Übersicht, Detail, Sonntagsrunde), nur Bereich mwf. Der Schritt eines Firmen-Ankers wird eine MWF-Aufgabe.

## 4. Casa bleibt ruhig

- Casa-Startseite, To-Dos, Woche, Anker zeigen nur Bereich casa.
- Arbeitstag an: MWF-Symbol oben auf der Startseite, meine heute fälligen MWF-Aufgaben unter „Heute noch“ mit kleinem Kürzel „MWF“. Sonst nichts.
- **Messetage**: werden aus `fairs` abgeleitet und in der Woche als Ereignis „Messe“ gezeigt, Wirkung „Max ist weg“ und „Anna ist weg“ nur am Sonntag. Das erzeugt die Valerie-Chips wie bei anderen Weg-Ereignissen. Kein Eintrag in `events`, darum kein Push und nichts zum Bearbeiten (Antippen führt in den MWF-Bereich).
- **Mitteilungen**: Push-Trigger und Morgenbriefing überspringen Bereich mwf, solange `mwf_notify` = aus. „nur im Morgenbriefing“: MWF-Aufgaben erscheinen im Briefing. „sofort“: wie Casa-Aufgaben. Einstellbar in den Einstellungen unter „Munich Watch Fair“, dort auch der Arbeitstag-Schalter.

## 5. Daten, die ich einspiele (nach deinem OK)

- 12 Messen (oben), 15 Vorlagenzeilen, Jahrespunkt „Marktfestsetzung“ (Anna, 31.12.2026).
- Vier Firmen-Anker wie im Auftrag, gemeinsam, Schritte als Aufgaben bis Mo 16.11.2026, a) und b) für dich angeheftet.
- Die Aufgaben der laufenden Runde (Messe 8.11.) entstehen beim ersten Öffnen automatisch.

## Annahmen

- Instagram-Post „2 Tage nach dem Online-Shop“ = 12 Tage vor der Messe.
- Vorlage gilt für euren Haushalt (Bereich mwf), nicht global.
- Die Februar–Juni-Termine 2026 kommen nicht in die Datenbank.
