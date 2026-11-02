# Casa v8 – Plan: Anker + offene Aufgaben

Stand 2.11.2026, vor dem Bauen.

## Datenmodell (eine Migration `20261102120000_anker_und_offene_aufgaben.sql`)

### Neue Tabelle `anchors` (Anker)
| Spalte | Bedeutung |
|---|---|
| id, household_id | wie überall |
| title | Titel |
| why | der Satz „warum“ |
| visibility | `shared` (gemeinsam) oder `private` (nur ich) |
| created_by | wer ihn angelegt hat (bei privat: nur der sieht ihn) |
| phase | `idee` · `klaeren` · `testen` · `entscheiden` · `laeuft` |
| step_text, step_who, step_due | der eine nächste Schritt: Text, wer (member_id, leer = beide), bis wann (Datum, darf leer sein) |
| notes | freier Text |
| moved_at | letzte Bewegung (wird bei jedem Verlaufseintrag und jeder Schrittänderung gesetzt) |
| archived_at | leer = aktiv; gesetzt = archiviert (statt löschen) |
| created_at, updated_at, updated_by | wie überall |

Sichtbarkeit per RLS: Haushalt **und** (`shared` oder `created_by = ich`). Private Anker kommen so gar nicht erst beim anderen an, auch nicht über Realtime.

### Neue Tabelle `anchor_log` (Verlauf)
| Spalte | Bedeutung |
|---|---|
| anchor_id | gehört zu |
| kind | `step_done` · `phase` · `note` · `question` · `sunday` |
| text | der Eintrag („Erledigt: …“, „Phase: Testen“, Notiz, „Geklärt: … – Antwort“, „Sonntagsrunde: besprochen“) |
| author_member_id | Autor |
| at | Datum des Eintrags (für den ersten Anker rückdatiert) |

### Neue Tabelle `anchor_questions` (offene Fragen)
anchor_id, text, resolved_at (leer = offen), created_by, sort.

### Neue Tabelle `anchor_pins` (Auf Startseite, pro Person)
member_id + anchor_id. Jeder sieht und ändert nur seine eigenen Pins.

### Änderungen an `tasks`
- `anchor_id` (optional, Verweis auf einen Anker; wird der Anker archiviert, bleibt die Aufgabe).
- `owner_member_id` darf jetzt **leer** sein = „Offen, noch niemand“.
- Push-Trigger angepasst: offene Aufgabe neu angelegt → der andere bekommt „Offen: Winterschuhe Valerie“ / „bis 30.11. – wer übernimmt?“. Übernehmen (leer → ich) löst keine Mitteilung aus. Morgenbriefing bleibt wie es ist (nur eigene Aufgaben).

Alle neuen Tabellen: RLS nach gleichem Muster, GRANTs für `authenticated`, Realtime an.

## Oberfläche

### Navigation
- Tab „Sonntag“ → „Anker“ (`/anker`). Alte Seite `Sonntag.tsx` fällt weg, `/sonntag` leitet auf `/anker` um.
- Neue Seiten: `/anker` (Übersicht), `/anker/:id` (Detail), `/anker/runde` (Sonntagsrunde).

### Übersicht (Vorlage AnkerListe)
- Kopf „Was uns wichtig ist / Anker“, rechts gestrichelter Knopf „Sonntagsrunde“.
- Gruppen In Bewegung · Ruht · Läuft mit Zähler. Ruht = `moved_at` älter als 21 Tage und Phase nicht Läuft. Leere Gruppen werden nicht gezeigt.
- Pro Anker: ⚓︎ Titel, kleines „Startseite“ wenn ich gepinnt habe, 5 Balken + Phasenname, „→ Schritt“ in Handschrift (oder „Nächsten Schritt festlegen“), „Max · bis Fr“, „bewegt vor 3 Wochen“ (braun bei Ruht).
- Unten „+ Neuer Anker“: kleines Fenster mit Titel, Warum, gemeinsam/nur ich → danach direkt ins Detail.
- Ganz unten „Archiv ansehen“ (nur wenn es archivierte gibt), antippen holt einen zurück.

### Detail (Vorlage AnkerDetail)
- „‹ Alle Anker“, Titel in Handschrift, Warum kursiv, Chip „gemeinsam“/„nur ich“, Schalter „⚓︎ Auf Startseite“. Titel/Warum/Sichtbarkeit antippen → Bearbeiten-Fenster (dort auch „Archivieren“).
- Fortschritt: 5 Balken mit Namen, antippen setzt die Phase und schreibt „Phase: Testen“ in den Verlauf.
- Nächster Schritt als Klebezettel: Text, „Max · bis Fr“, Knopf „erledigt“. Nach „erledigt“: Verlauf „Erledigt: …“, der Zettel fragt „Und der nächste Schritt?“ mit Eingabe (Text, Max/Anna/beide, bis wann), Knöpfe „Festlegen“ und „später“. Leer → „Nächsten Schritt festlegen“. Schritt antippen = ändern.
- Offene Fragen in Handschrift mit „?“; antippen → geklärt, kleine Nachfrage „Antwort dazu?“ (optional, wird Verlaufseintrag), Frage rutscht durchgestrichen nach unten. „+ Frage“. Geklärte Frage antippen = wieder öffnen.
- Verlauf: neueste oben, links Datum (heute · gestern · Mo · 20.09.), Text, Autor klein. „+ Notiz“.
- Notizen: Textfeld, speichert beim Verlassen.
- Aufgaben dazu: Aufgaben mit diesem Anker (offene zuerst, abhakbar, antippen öffnet die Aufgabe), „+ Aufgabe“ öffnet Neu mit vorgewähltem Anker.

### Sonntagsrunde
- Reihenfolge: alle gemeinsamen, aktiven Anker, ruhende zuerst, dann nach letzter Bewegung.
- Pro Anker eine Seite: „2 von 5“, Titel, Phase, die letzten drei Verlaufseinträge, der nächste Schritt. Knöpfe „passt so“ · „Schritt ändern“ · „Phase ändern“ · „Notiz“, dann „Weiter“.
- „passt so“ und „Weiter“ schreiben „Sonntagsrunde: besprochen“ in den Verlauf (zählt als Bewegung) und gehen zum nächsten.
- Ende: „Fertig – bis nächsten Sonntag“, zurück zur Übersicht. Keine gemeinsamen Anker → Hinweis.

### Startseite
- Nur heute, ganz unten in der linken Spalte (unter „Heute noch“ und „Demnächst“): meine gepinnten Anker als kleine weiße Etiketten „⚓︎ Titel“, brauner Punkt wenn Ruht. Antippen → Detail. Keine Pins → nichts.
- Offene Aufgaben (heute fällig oder überfällig) als gestrichelter Chip „Winterschuhe Valerie · übernehmen“ unter den Zeilen von „Heute noch“. Antippen → ich bin Besitzer, Zeile erscheint normal.

### Aufgaben
- Neu und Aufgabe bearbeiten: bei „Wer kümmert sich?“ zusätzlich „Offen“. Darunter „Anker“ (nur wenn es Anker gibt): „keiner“ + Titel der sichtbaren Anker.
- To-Dos: neue Gruppe ganz oben „Offen – wer übernimmt?“ mit gestrichelten Chips „Titel · bis Fr · übernehmen“, für beide sichtbar.

## Erster Anker „Externes Büro“ (echte Datenbank, nach deinem Ja)
- gemeinsam, Phase Testen, von Max angelegt, für Max gepinnt.
- Schritt: „Selbst einen Vormittag im Coworking arbeiten“ · Max · Fr 6.11.2026.
- Fragen: die drei aus dem Auftrag.
- Verlauf (rückdatiert): 1.9.2026 „Idee: lieber Wohnung auf Zeit als Coworking, zum Arbeiten und Übernachten“ · 20.9.2026 „Kandidat gefunden: möblierte Wohnung am Samerberg, Anfrage geschickt“ · 28.10.2026 „Anna mietet Coworking für einen Monat, für uns beide“. Letzte Bewegung = 28.10. (In Bewegung).
- Notizen wie im Auftrag.
- Im Demo-Modus gibt es denselben Anker als Beispiel.

## Nicht drin (bewusst)
- Keine Mitteilung bei Anker-Änderungen, kein NEU-Stempel für Anker.
- Keine Erinnerung am Sonntag (die Runde startet man von Hand).
- Keine Zuordnung von Terminen zu Ankern.
