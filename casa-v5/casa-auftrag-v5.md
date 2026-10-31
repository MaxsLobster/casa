# Casa – Auftrag v5 (oberer Rand, Papier dezenter, Startbild)

Hi Claude Code. v4 mit Analog-Look läuft und gefällt. Diese Runde ist klein: drei Punkte, nur Optik. **Das App-Icon bleibt vorerst wie es ist.** Keine Datenbank-Änderung.

Bitte erst **komplett lesen**, dann Max kurz deinen Plan zeigen, dann bauen. Am Ende kurze Zusammenfassung in einfachen Worten.

Design-Vorlagen in `design-referenz-v5/` (wie immer nur Optik, nicht die Technik):
- `Analog.dc.html`: Stufe **„mittel“** ist das neue Ziel für das Papier (Knopf „Papier“ schaltet stark / mittel / aus)
- `Startbild2.dc.html`: Variante **„Zettel“** ist gewählt (Verblassen und Heben ignorieren)

---

## 1. Oberer Rand: Papier bis ganz nach oben

Aktuell liegt hinter der iPhone-Statusleiste (Uhrzeit, Akku) eine glatte dunkle Fläche, die per Verlauf ins Papier übergeht. Das sieht aus wie ein Balken.

- Das Papier (Kacheln, Punktraster, Vignette) läuft **bis ganz oben hinter die Statusleiste**, ohne Verlauf und ohne Kante.
- `viewport-fit=cover`, `apple-mobile-web-app-status-bar-style` = `black-translucent`.
- Papier-Hintergrund auf `html`/`body`, nicht auf dem Inhalts-Container. Inhalt mit `padding-top: env(safe-area-inset-top)`.
- `theme-color` passend zu hell und dunkel.
- Den Verlauf oben entfernen.
- Unten hinter der Home-Leiste dasselbe prüfen.
- Hell und dunkel testen, auch mit Papier-Look aus.

---

## 2. Papier dezenter („mittel“)

Am Morgen im hellen Modus wirkt das Papier zu grau, fleckig und künstlich alt, die Schrift ist schlechter lesbar als vorher. Ziel ist ein Mittelding: Papiergefühl ja, Alterung nein. Vorlage: `Analog.dc.html`, Stufe **mittel**.

**Hell**
- Papierton heller und sauberer: `#F5F1E8`
- Körnung etwa **halb so stark** wie jetzt
- Fleckigkeit fast weg (nur ein Hauch)
- **Keine Fasern**
- Vignette kaum spürbar
- Die große Datumszahl **ohne** rauen Tinte-Filter, nur der dezente Buchdruck-Schatten
- Innenseite der Zeitstrahl-Röhre im Papierton, nicht reinweiß

**Dunkel**
- Bleibt fast wie jetzt, das gefällt. Nur Fleckigkeit und Vignette etwas zurücknehmen, damit hell und dunkel gleich ruhig wirken.

**Bleibt unverändert:** gestanzte Löcher, handgezeichnete Kreise, Schraffur, Gold als Aquarell, Mond, raue Ränder der Handschrift.

Prüfen: Lesbarkeit hell bei Tageslicht ist wichtiger als Stimmung. Im Zweifel lieber noch etwas heller.

---

## 3. Startbild: Zettel (Vorlage: Startbild2.dc.html, Variante „Zettel“)

**Statisches Startbild von iOS** (`apple-touch-startup-image`)
- Das zeigt iOS, bevor die App geladen ist. Es kann sich nicht bewegen.
- Motiv: **Navy-Papier** mit einem cremefarbenen Klebezettel in der Mitte (ca. 120 px, leicht gedreht, goldenes Klebeband, handgezeichneter Haken – siehe Vorlage), sonst nichts.
- Bewusst immer Navy statt hell. iOS kann das Startbild nicht nach Uhrzeit wechseln, mit Navy gibt es abends keinen hellen Blitz.
- Bilder für die gängigen iPhone-Größen erzeugen (aktuelle Modelle reichen), Hochformat, inkl. passender `media`-Abfragen. iPad ebenfalls, falls Anna Casa dort nutzt.

**Kurze Animation direkt danach (in der App)**
- Das erste Bild der App sieht **exakt aus wie das Startbild** (Navy, Zettel in der Mitte). So gibt es keinen Sprung.
- Dann:
  1. Der Zettel dreht sich leicht, wird etwas kleiner (ca. 90 %) und verblasst, ca. 0,6 s.
  2. Die Navy-Fläche blendet weich aus (ca. 0,4 s). Darunter liegt Heute im aktuellen Modus. Hell heißt sanftes Überblenden, dunkel ist nahtlos.
  3. Die Zeilen von Heute erscheinen nacheinander von oben nach unten, je mit kurzem Unschärfe-zu-scharf und 5 px Hochrutschen, ca. 80 ms versetzt.
- Insgesamt **höchstens ca. 1,3 Sekunden**, ruhig, keine Federeffekte.
- **Nur beim echten Kaltstart** (App neu geladen). Nicht beim Zurückwechseln in die App, nicht beim Tab-Wechsel.
- Antippen überspringt die Animation.
- Bei `prefers-reduced-motion`: keine Animation, nur kurzes Überblenden.
- Push-Antippen, das direkt eine Stelle öffnet: Animation weglassen, direkt zur Stelle.

---

## Hinweis Startbild

Falls iOS das **statische** Startbild erst übernimmt, wenn die App neu zum Home-Bildschirm hinzugefügt wird: **nicht** neu installieren lassen (Login und Mitteilungen gingen verloren). Dann das statische Bild vorbereiten und erst zusammen mit dem neuen Icon später aktivieren. Die Animation in der App funktioniert ja sofort.

---

## Fertig ist v5, wenn

- [ ] Papier läuft oben hinter der Statusleiste und unten hinter der Home-Leiste durch, ohne Balken oder Verlauf, hell und dunkel
- [ ] Papier hell deutlich ruhiger und heller (Stufe mittel), dunkel leicht beruhigt, Lesbarkeit top
- [ ] Statisches Startbild Navy mit Zettel für die gängigen iPhone-Größen
- [ ] Animation nach dem Start: Zettel verblasst, Heute erscheint zeilenweise, ≤ 1,3 s, nur beim Kaltstart, überspringbar
- [ ] Reduced Motion und Push-Einstieg ohne Animation
- [ ] App-Icon unverändert
