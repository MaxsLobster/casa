# Casa – Auftrag v3 (Feedback-Runde 3: To-Dos, Woche, Schrift)

Hi Claude Code. v2 läuft, Push funktioniert. Das hier ist die nächste Feedback-Runde von Max und Anna. Drei Themen, **nur Oberfläche**, keine neuen Tabellen nötig (falls doch, kurz begründen).

Bitte erst **komplett lesen**, dann Max kurz deinen Plan zeigen, dann bauen. Am Ende eine kurze Zusammenfassung in einfachen Worten.

Design-Vorlage: `design-referenz-v3/Woche3.dc.html`. Wie gehabt ist das ein Mockup für einen Design-Editor: **nur Optik und Aufbau übernehmen**, nicht die Technik (`support.js`, `<x-dc>`, `DCLogic` gibt es bei uns nicht). Die Daten im Mockup sind Beispiele. Farben, Schriften und Notizbuch-Look bleiben wie bisher.

---

## 1. To-Dos – nur noch meine

**Reiter weg**
- Die Reiter **Max · Anna · Alle entfallen komplett**.
- Jeder sieht in To-Dos **nur die Aufgaben, bei denen er selbst Besitzer ist**. Anna sieht nicht Max' Aufgaben, Max nicht Annas.
- Falls es in der Datenbank noch Aufgaben ohne eindeutigen Besitzer gibt (früher „beide/alle“): bei beiden anzeigen und Max kurz im Plan nennen, wie viele das sind.

**Erledigtes vom anderen bleibt sichtbar**
- In **„Geschafft diese Woche“** stehen meine **und** die erledigten Aufgaben des anderen, jeweils mit kleinem Namen dahinter (z. B. „Altglas weggebracht · Anna“).
- Weiterhin **keine Push-Mitteilung** beim Abhaken.

**Gruppen auf- und zuklappbar**
- Bestehende Gruppen bleiben (Liegt noch · Heute · Diese Woche · Später · Geschafft diese Woche – so wie sie aktuell heißen).
- Jede Gruppe hat eine Kopfzeile: Name, Anzahl, kleiner Pfeil. Antippen klappt auf/zu.
- Standard: **Liegt noch** und **Heute** offen, Rest zu.
- Der Zustand wird pro Gerät gemerkt (localStorage reicht).
- Leere Gruppen ausblenden.
- NEU-Stempel und „Erledigt ansehen“ (Archiv) bleiben wie bisher.

---

## 2. Woche – Zeichen statt Text (Vorlage: Woche3)

Ziel: Auf einen Blick sehen, wie voll ein Tag ist und ob etwas offen ist. **Text erst beim Antippen.**

**Kopf**
- Nur noch ‹ Datumsbereich + KW › (z. B. „26. Okt. – 1. Nov.“ / „KW 44“). Beliebig weit blättern bleibt.
- **Reiter „Diese Woche · Nächste Woche · Normalwoche“ entfallen.** Standard ist immer die aktuelle Woche.
- Antippen des Datumsbereichs springt zurück zur aktuellen Woche (nur wenn man weggeblättert hat).
- **Normalwoche** = kleines Kalender-Symbol rechts im Kopf (Kalender mit Kreispfeil, ohne Text, `aria-label="Normalwoche bearbeiten"`). Öffnet die bisherige Normalwochen-Ansicht zum Bearbeiten.

**Stundenskala**
- Eine dezente Zeile über den Tagen: 6 · 10 · 14 · 18 · 22, exakt über dem Band ausgerichtet.

**Eine Zeile pro Tag (zugeklappt)**
- Links: Wochentag (Kapitälchen) + Datum klein darunter.
- Mitte: **Mini-Band 6–22 Uhr**, schmal, abgerundet:
  - **Gold (halbtransparent) = Valerie ist versorgt.** Kita, Oma und Theresa zählen alle als versorgt, für die ganze Zeit, in der Valerie bei ihnen ist. Bei mehrtägigen Aufenthalten (z. B. bei Oma) den ganzen Tag gold.
  - **Navy = Termine**, die mich oder beide betreffen. Navy liegt über Gold.
  - **Heute:** Band bis zur aktuellen Uhrzeit leicht graublau gefüllt, mit brauner Kante (wie der Zeitstrahl auf Heute). Aktualisiert sich minütlich.
- Rechts, kleine Symbole:
  - **Gestrichelter brauner Kreis** = es gibt an dem Tag einen offenen Slot (Essen, Bett, Familientag).
  - **Navy-Kreis mit Zahl** = so viele **meiner offenen Aufgaben** sind an dem Tag fällig. Nur eigene, nur unerledigte. Bei vergangenen Tagen keine Zahl (Überfälliges steht in To-Dos).
- **Vergangene Tage** blass (ca. 50 % Deckkraft), **heute** leicht gold hinterlegt, Wochentag braun.
- Keine Texte wie „du holst, Anna kocht“ in der zugeklappten Zeile.

**Antippen = Details**
- Es ist immer nur ein Tag aufgeklappt. Beim Öffnen der Ansicht ist **heute** aufgeklappt (in anderen Wochen keiner).
- Inhalt wie bisher in Handschrift mit kleinen Kapitälchen-Labels: Valerie (wer bringt/holt), Abend, Termine mit Uhrzeit, mehrtägige Ereignisse, Wiederholungen mit ↻.
- Offene Slots als gestrichelter Chip „Essen offen · übernehmen“. Antippen = ich übernehme (oder wähle Anna), wie bisher.
- **„Für dich fällig“**: meine Aufgaben des Tages mit Kreis zum direkten Abhaken.

**Mehrtägige Ereignisse**
- Bleiben als **schmale senkrechte Streifen am rechten Rand** über die betroffenen Tage (Gold für Valerie-Betreuung, Navy für andere). **Ohne Beschriftung** in der zugeklappten Ansicht; der Text steht in den Details der betroffenen Tage.
- Läuft ein Ereignis in die Woche hinein oder hinaus: oben bzw. unten ausgeblendeter Verlauf (siehe Vorlage).

**Legende**
- Eine kleine kursive Zeile unten: „Gold: Valerie versorgt · Navy: Termin · Kreis mit Zahl: deine Aufgaben · gestrichelt: noch offen · Streifen rechts: mehrere Tage“.

---

## 3. Schrift – etwas größer und schärfer (ganze App)

Max und Anna lesen fast nur am iPhone. Die Schrift soll überall **ein kleines Stück größer** werden, dadurch wirkt sie schärfer:
- Alle Schriftgrößen um ca. **+8–10 %** (ein bis zwei Pixel), auch in der Woche-Vorlage, die noch die alten Größen hat.
- **Nichts unter 12 px.** Kapitälchen-Labels mindestens 12 px, Handschrift (Caveat) mindestens 21 px.
- Newsreader im Fließtext mit Gewicht 500 statt 400 prüfen. Wenn es deutlich klarer wirkt, übernehmen.
- Grauen Text (#6E6A60) einen Tick dunkler, wenn er auf dem gepunkteten Papier blass wirkt (z. B. #5F5B52).
- Danach **jede Seite auf 375, 390 und 430 px Breite prüfen**: keine Überlappungen, keine abgeschnittenen Zeilen, Tap-Flächen weiterhin mindestens 44 px. Auch im dunklen Modus (ab 20 Uhr) prüfen.

---

## Fertig ist v3, wenn

- [ ] To-Dos ohne Reiter, jeder sieht nur seine Aufgaben
- [ ] „Geschafft diese Woche“ zeigt auch Erledigtes des anderen mit Namen
- [ ] Gruppen klappbar, Liegt noch + Heute standardmäßig offen, Zustand gemerkt
- [ ] Woche ohne Reiter, Normalwoche über das Symbol erreichbar
- [ ] Pro Tag Mini-Band (Gold/Navy, heute gefüllt) und Symbole statt Text
- [ ] Antippen klappt Details auf, offene Slots übernehmbar, Aufgaben abhakbar
- [ ] Mehrtägige Ereignisse als Streifen rechts
- [ ] Schrift überall etwas größer, keine Überlappungen auf 375/390/430 px, hell und dunkel

Am Ende: kurze Zusammenfassung für Max in einfachen Worten und was er am iPhone prüfen soll.
