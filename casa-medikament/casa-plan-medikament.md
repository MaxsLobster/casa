# Plan · Bereich „Medikament“ (privat, nur Max) + Mila-Änderungen + Schrift

Noch nichts gebaut. Erst nach Max' Okay.

## 1. Bereich Medikament

### Einstieg
- Neues Symbol (Kapsel) oben neben dem Topf, Adresse `#/med`. Eigener Bereich wie Mila, mit „‹ Casa“ oben.
- Schalter „Medikament“ in den Casa-Einstellungen. Der Schalter erscheint nur bei Max: Die Datenbank legt die Einstellungszeile nur für Max an, niemand sonst kann eine anlegen.
- Privat per Row Level Security: Jede Zeile gehört einem Mitglied, lesen und schreiben darf nur dieses Mitglied. Anna bekommt von der Datenbank nichts zurück, auch nicht mit Tricks.

### Tabellen (eine Migration)
| Tabelle | Inhalt |
|---|---|
| `med_settings` | pro Person: Bereich an/aus, vier Push-Zeiten (7:30, 11:00, 15:00, 20:00), „Anna fragen“ an/aus, Zeit für Annas Frage (20:30) |
| `med_courses` | Medikament + Dosis + Startdatum. Neuer Eintrag bei Wechsel, alte bleiben. Name leer = „kein Medikament“. Start: Lisdexamfetamin 30 mg ab heute |
| `med_days` | pro Tag: „Genommen“ mit Uhrzeit, Schlaf 1–5 |
| `med_checkins` | pro Tag und Zeitpunkt (11/15/20): Fokus, Ruhe im Kopf, Stimmung (je 1–5), Notiz; abends zusätzlich Appetit und Nebenwirkungen |
| `med_partner_answers` | Annas Antwort pro Tag: Wert 1–5, Notiz. Anna sieht nur ihre eigenen Zeilen, Max nur die über ihn |
| `settings.med_partner_ok` | Annas eigene Zustimmung (Standard: aus) |

Annas Frage läuft nur, wenn beide Schalter an sind: „Anna fragen“ bei Max und Annas Zustimmung in ihren Einstellungen. Anna erfährt nur, dass Max fragen möchte, sonst nichts.

### Screens
1. **Heute** (`#/med`): großer Knopf „Genommen“ (speichert die Uhrzeit, antippen ändert sie), Schlaf-Regler, darunter die drei Check-ins des Tages (offen oder ausgefüllt) und der Tagesverlauf als kleine Linie mit markierter Einnahmezeit. Annas Wert und Notizen darunter. Mit ‹ › zu früheren Tagen.
2. **Check-in** (`#/med/check/11` usw.): drei große Regler 1–5, Notiz optional, „Fertig“. Abends dazu Appetit und Chips für Nebenwirkungen. Ziel: unter 10 Sekunden.
3. **Übersicht** (`#/med/uebersicht`): pro Medikament und Dosis die Durchschnitte (Fokus, Ruhe, Stimmung je Tageszeit, Schlaf, Appetit, Annas Wert) mit Anzahl der Tage. Knopf „Als Text kopieren“ für die Ärztin.
4. **Einstellungen im Bereich** (`#/med/einstellungen`): Medikament und Dosis (Verlauf), Push-Zeiten, „Anna fragen“.
5. **Annas Frage** (`#/med/anna`): „Wie war Max heute Abend?“, Regler angespannt bis entspannt, Notiz optional.

Regler: fünf große runde Felder nebeneinander (je mindestens 52 px), ein Tipp wählt. Das ist am Daumen schneller und sicherer als ein Schieberegler.

### Push
- 7:30 „Guten Morgen · genommen?“, 11:00 / 15:00 / 20:00 „Kurzer Check-in“. Antippen öffnet direkt den passenden Check-in.
- Kein Medikamentenname in der Mitteilung (Sperrbildschirm).
- Kommt nur, wenn der Bereich an ist, Mitteilungen an sind und der Check-in noch leer ist. Ruhezeiten gelten. Kein Nachhaken.
- 20:30 an Anna: „Wie war Max heute Abend?“, nur mit ihrer Zustimmung.
- Technik wie das Morgenbriefing: eine Datenbank-Funktion prüft minütlich die Uhrzeiten.

### Bewusst nicht drin
Keine Streaks, keine roten Markierungen, keine Bewertungen, keine Ratschläge. Verpasstes bleibt leer.

## 2. Mila (so verstehe ich es, bitte bestätigen)
- **Keine automatischen Vorschläge mehr, kein automatischer Wochenplan.** Mila verteilt nichts mehr von selbst auf die Woche und übernimmt nichts mehr automatisch. Die Mitteilung „Mahlzeiten stehen“ entfällt.
- **In Casa (Heute, Woche) stehen nur Gerichte, die ihr selbst in die Mila-Woche eintragt.**
- **Die Wochenkarte bleibt zum Wählen**, ist aber immer offen: ab Montag für die nächste Woche, bis Sonntag 20 Uhr. Die Karte für die Woche ab 16.11. öffnet sofort.
- Nach der Aufdeckung zeigt Mila nur die **Trefferliste**. Ein Treffer lässt sich mit einem Tipp auf einen Tag legen. Den Einkaufszettel füllt ihr per Knopf „Zutaten auf den Zettel“ aus der selbst gefüllten Woche.
- Die Prep-Stunde bleibt als Seite, der feste Sonntagstermin in der Casa-Woche entfällt.

## 3. Schrift
Alle Schriftgrößen der App rund 4 % größer (ein zentraler Wert, kein Umbau der einzelnen Seiten).

## Nach dem Update
Push muss nicht neu erlaubt werden. Max schaltet den Bereich einmal in den Einstellungen an. Anna schaltet ihre Zustimmung selbst an, wenn sie mag.
