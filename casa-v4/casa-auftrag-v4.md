# Casa – Auftrag v4 (Kleinigkeiten + Analog-Look)

Hi Claude Code. v3 läuft. Diese Runde hat zwei Teile: ein paar **Kleinigkeiten** aus dem ersten Test und ein neuer **Analog-Look** für die ganze App. Keine neuen Tabellen nötig, außer einem Feld für die Legende (siehe 1.2).

Bitte erst **komplett lesen**, dann Max kurz deinen Plan zeigen, dann bauen. Am Ende kurze Zusammenfassung in einfachen Worten.

Design-Vorlage: `design-referenz-v4/Analog.dc.html` (Heute-Ansicht im Analog-Look, hell und dunkel). Wie immer: **nur Optik übernehmen**, nicht die Technik (`support.js`, `<x-dc>`, `DCLogic` gibt es bei uns nicht). Die Knöpfe „Analog an/aus“ und „Hell/Dunkel“ im Mockup sind nur zum Vergleichen da.

---

## 1. Kleinigkeiten

**1.1 Dunkelmodus: Gold und Navy sichtbar machen**
- Im Dunkelmodus ist Navy (Termine) auf navy Hintergrund unsichtbar, Gold wirkt grau.
- Eigene Dunkel-Farben, in **Woche-Band, Zeitstrahl und überall**, wo Gold/Navy Bedeutung tragen:
  - Gold → Bernstein `#D9AE62`
  - Navy (Termine) → Creme `#E9E1CF`
  - Braun (Jetzt-Kante, Akzente) → `#E0B977`
- Die gesamte Dunkel-Palette steht unten bei Analog.

**1.2 Legende in der Woche wegklickbar**
- Die Legendenzeile unten bekommt rechts ein kleines **×**.
- Tippen → kurze Frage „Nicht mehr anzeigen?“ (Ja / Abbrechen) → Legende verschwindet dauerhaft.
- Gespeichert **pro Person** (z. B. in `member_settings`), nicht pro Gerät, damit sie bei Anna auch auf dem iPad weg bleibt.
- In den Einstellungen: „Legende wieder anzeigen“.

**1.3 Woche: heute nicht aufgeklappt**
- Beim Öffnen der Woche ist **kein Tag aufgeklappt**. Heute ist nur markiert (gold hinterlegt, Wochentag braun), so wie es zugeklappt jetzt schon aussieht.

**1.4 Heute: Einstellungen als Zahnrad**
- Der Eintrag „Einstellungen“ unten auf Heute entfällt.
- Dafür ein **kleines Zahnrad oben rechts** in der Ecke (Tap-Fläche mindestens 44 px, Symbol dezent in Grau). Darf die Sonne/Mond-Zeile nicht verschieben.

**1.5 Heute: „heute fällig“ weg**
- Unter „Heute noch“ steht bei jeder Aufgabe „heute fällig“. Das ist doppelt und klebt an der zweiten Zeile → **entfernen**.
- Nur wenn eine Aufgabe eine Uhrzeit hat, die Uhrzeit klein anzeigen.

**1.6 Woche-Details: keine Doppelung bei offenen Slots**
- Aktuell steht „Abend: Essen und Bettgehen offen“ **und** der Chip „Abend offen · übernehmen“.
- Offene Slots **nur als Chip** zeigen, die Textzeile dazu weglassen.

---

## 2. Analog-Look (Vorlage: Analog.dc.html)

Ziel: Casa soll aussehen wie ein echtes, benutztes Notizbuch. **Matter, wärmer, lebendiger**, nicht wie eine glatte App. Gilt für alle Seiten.

**2.1 Papier**
- Papierton hell: `#F2EDE2` (statt #F4F1EA), dunkel: `#1A2340`.
- Drei feine Ebenen über dem Papierton, plus das bestehende Punktraster:
  - **Körnung**: feines Rauschen
  - **Fleckigkeit**: sehr großflächige, leichte Farbschwankung wie altes Papier
  - **Fasern**: ganz dezent, sie dürfen nicht nach Stoff/Jeans aussehen
- **Vignette**: Ränder minimal dunkler, wie Papier unter einer Lampe.
- **Wichtig für Leistung:** Die Texturen als **vorgerenderte Kacheln** (PNG oder WebP, z. B. 256 px, nahtlos) ausliefern, **nicht** als Live-SVG-Filter im Hintergrund. Die Werte aus der Vorlage (feTurbulence-Parameter) dienen als Ausgangspunkt zum Erzeugen.
- Im Dunkelmodus helles Korn auf dunklem Papier.

**2.2 Gestanzt statt gestrichelt**
- Die Perforationslinie links wird zu einer Reihe **kleiner gestanzter Löcher** mit Schatten- und Lichtkante.
- Die gepunktete Abreißlinie unter dem Datum auf Heute wird ebenfalls zu einer Reihe gestanzter Löcher.

**2.3 Tinte**
- Tintenfarbe hell: `#243150` (etwas matter als bisher), dunkel: Creme `#E9E1CF`.
- **Handschrift (Caveat)**: leicht unruhige Ränder per SVG-Filter (Displacement, kleine Stärke) plus minimales Ausbluten per `text-shadow`.
- Den Filter **nur auf Handschrift und Zeitstrahl** anwenden, nicht auf ganze Listen-Container. Am echten iPhone prüfen, ob Scrollen flüssig bleibt. Falls nicht: Filter weglassen und nur `text-shadow` behalten.
- **Große Datumszahl auf Heute**: wirkt eingedrückt wie im Buchdruck (heller Schatten unten, dunkler oben, sehr dezent).

**2.4 Handgezeichnete Kreise**
- Alle Abhak-Kreise (Heute, To-Dos, Woche-Details) als **handgezeichneter Kreis**: SVG-Pfad, der nicht ganz perfekt schließt (Pfad steht in der Vorlage).
- Abgehakt: gleicher Kreis gefüllt mit Haken, **ohne** Animation.

**2.5 Zeitstrahl und Woche-Band**
- Röhre mit leicht unregelmäßigem Rand, wie mit Bleistift gezogen.
- Vergangene Zeit **schraffiert** (feine diagonale Linien) statt flächig gefüllt. Jetzt-Kante und Punkt in Braun bleiben.
- **Gold als Aquarell**: weiche, leicht unregelmäßige Kanten, Rand etwas dunkler, wo sich die Farbe sammelt.
- Termine (Navy, im Dunkeln Creme) bleiben klar und flächig, damit sie sich vom Aquarell abheben.
- Dasselbe gilt für das Mini-Band in der Woche (dort zurückhaltender, weil klein).

**2.6 Mond in echter Phase**
- Statt Kreis-Symbol ein kleiner **gezeichneter Mond** (ca. 22 px) in der echten Phase des Tages: beleuchteter Anteil und Seite (zunehmend rechts, abnehmend links) aus `suncalc` (`getMoonIllumination`).
- Leichte Kraterstruktur, dunkler Teil dezent sichtbar.

**2.7 Dunkel-Palette (gesamt)**
- Papier `#1A2340`
- Tinte / Text `#E9E1CF`
- Grau `#A39D8C`
- Gold `#D9AE62`
- Braun `#E0B977`
- Linien `rgba(233,225,207,0.14)`
- Plus-Knopf: Creme mit dunklem Plus

**2.8 Schalter in den Einstellungen**
- „Papier-Look“ an/aus, **standardmäßig an**. Aus = der bisherige glatte Look. Falls es auf einem Gerät ruckelt, kann man so ausweichen.

---

## Fertig ist v4, wenn

- [ ] Dunkelmodus: Termine und Gold überall klar sichtbar
- [ ] Legende mit ×, pro Person dauerhaft ausblendbar, in Einstellungen wieder einblendbar
- [ ] Woche öffnet ohne aufgeklappten Tag, heute nur markiert
- [ ] Zahnrad oben rechts auf Heute, „Einstellungen“ unten weg
- [ ] „heute fällig“ unter Heute noch entfernt
- [ ] Offene Slots in Woche-Details nur als Chip
- [ ] Papier mit Körnung, Fleckigkeit, Fasern, Vignette als Kacheln, hell und dunkel
- [ ] Gestanzte Löcher statt Strichellinien
- [ ] Tinte mit leicht rauen Rändern auf Handschrift, Datumszahl im Buchdruck-Look
- [ ] Handgezeichnete Kreise überall
- [ ] Zeitstrahl und Woche-Band: Bleistift-Röhre, Schraffur, Gold als Aquarell
- [ ] Mond in echter Phase
- [ ] Schalter „Papier-Look“ in den Einstellungen
- [ ] Scrollen am iPhone flüssig, keine Überlappungen auf 375/390/430 px

Am Ende: kurze Zusammenfassung für Max und was er am iPhone prüfen soll.
