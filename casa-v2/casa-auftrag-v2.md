# Casa – Auftrag v2 (Feedback nach der ersten Woche)

Hi Claude Code. Casa läuft (Phase 1). Max und Anna nutzen es seit einer Woche. Dieser Auftrag bündelt ihr Feedback und die neuen Entwürfe.

Bitte erst **komplett lesen**, dann Max kurz deinen Plan zeigen, dann in **zwei Schritten** bauen:
1. **Schritt 1: Push-Mitteilungen + Datenmodell** (dringend: Anna hat gestern eine Aufgabe eingetragen, Max hat es nicht gemerkt)
2. **Schritt 2: neue Oberfläche** (Startseite, Woche, To-Dos)

Nach Schritt 1 stoppen, Max testet am iPhone, dann weiter.

Design-Vorlagen liegen in `design-referenz-v2/` (`StartB1.dc.html` = Startseite, `Woche2.dc.html` = Woche, `ToDos.dc.html` = To-Dos). Das sind Mockups für einen Design-Editor: **nur Optik und Aufbau übernehmen**, nicht die Technik (`support.js`, `<x-dc>`, `DCLogic` gibt es bei uns nicht). Farben, Schriften, Notizbuch-Look bleiben wie bisher.

---

## Schritt 1 – Push-Mitteilungen

Technik: Web Push (VAPID) über Supabase Edge Function, Zeitpläne per pg_cron. Service Worker ist schon vorbereitet.

**Wann eine Mitteilung kommt**
- **Sofort**, wenn der andere für mich eine Aufgabe einträgt oder ändert, einen Termin einträgt, der mich betrifft (ich oder „beide“), oder eine Abweichung in der Woche setzt, die mich betrifft. **Nie für eigene Einträge.** Keine Mitteilung, wenn der andere etwas abhakt.
- **Morgenbriefing**: jeden Tag zu einer Uhrzeit, die jeder selbst einstellt (Standard 7:00). Inhalt: heutige Termine und heute fällige Aufgaben, plus was morgen fällig ist. **Entfällt**, wenn die Person die App an diesem Tag vor der Uhrzeit schon geöffnet hat.
- **Ruhezeiten**: in den Einstellungen „Ruhe von – bis“, pro Person, **standardmäßig aus**. Was in der Ruhezeit anfällt, kommt danach gesammelt.

**Text der Mitteilung** – locker, mit Inhalt, z. B.:
- „Von Anna auf deinen Zettel: Gartenlounge abdecken · bis Di“
- „Anna hat einen Termin eingetragen: Do 15:00 Elternabend“
- Morgenbriefing: „Guten Morgen · heute: 18:00 Grillen, Altpapier rausstellen“

**Antippen** öffnet direkt die passende Stelle in der App.

**Einstellungen**
- Knopf „Mitteilungen aktivieren“ (iOS braucht einen echten Tipp dafür) und „Test-Mitteilung senden“
- Uhrzeit Morgenbriefing, Ruhezeiten
- Kurzer Hinweis, falls die App nicht vom Home-Bildschirm gestartet wurde (sonst geht Push am iPhone nicht)

**„Neu“-Markierung**
- Was der andere für mich eingetragen hat, ist in der App mit einem **NEU**-Stempel markiert, bis ich es einmal angesehen habe. Keine Lesebestätigung für den anderen.

**Datenmodell (in Schritt 1 mit anlegen)**
- `push_subscriptions`, `member_settings` (Briefing-Uhrzeit, Ruhezeiten, letzte App-Öffnung)
- `seen_at` pro Mitglied für Aufgaben/Termine (für NEU)
- **Personen ohne Login** (`people`): Oma, Theresa – für Valerie-Betreuung und Ereignisse. Später erweiterbar.
- **Mehrtägige Ereignisse** (Start- und Enddatum), z. B. „Valerie bei Oma So–Di“
- **Wiederholungen** für Termine/Ereignisse/Aufgaben: wöchentlich, monatlich, jährlich (RRULE oder einfaches eigenes Format)
- **Archiv**: erledigte Aufgaben nie löschen

**Ende Schritt 1:** Anleitung in einfachen Worten, was Max und Anna am iPhone tun müssen, damit Mitteilungen ankommen. Dann stoppen.

---

## Schritt 2 – Neue Oberfläche

Untere Leiste: **Heute · Woche · [+] · To-Dos · Sonntag** (der Tab „Offen“ heißt jetzt **To-Dos**; „Sonntag“ bleibt Platzhalter).

### Heute (Vorlage: StartB1)

**Kopf (ruhig, keine Kalendergrafik)**
- Große Datumszahl, daneben Wochentag in Handschrift, darunter klein „Monat · KW“
- Gepunktete Abreißlinie
- Eine Zeile: Sonnenaufgang–Sonnenuntergang (lokal berechnet, z. B. mit `suncalc`, Standort Chiemsee ca. 47,85° N / 12,40° O), Mondphase, rechts drei kleine Symbole:
  - Feder = Weisheit des Tages · „Aa“ = Wort des Tages · Sanduhr = Heute vor … Jahren
- **Satz des Tages ist standardmäßig verborgen.** Tippt man ein Symbol, erscheint der Text darunter. **Pro Tag kann nur eine Kategorie gewählt werden**, die anderen beiden werden blass und gesperrt. Das gewählte Symbol blendet den Text ein und aus. Gilt pro Person, setzt sich um Mitternacht zurück.
- Inhalte als JSON-Listen im Repo, eine pro Kategorie. Weisheiten: gemeinfreie Klassiker (Seneca, Marc Aurel, Goethe …). Wort des Tages: schöne/seltene deutsche Wörter mit kurzer Erklärung. Heute vor Jahren: **nur gut belegte Ereignisse**, Max prüft die Liste stichprobenartig.

**Inhalt (links)**
- **Klebezettel „Neu von Anna/Max“**, solange etwas Neues ungesehen ist (führt zu To-Dos)
- **„Heute noch“**: nur heutige Termine, die **noch nicht vorbei** sind, und heute fällige Aufgaben. Termin vorbei = Endzeit erreicht; ohne Endzeit 1 Std. nach Beginn; ganztägig um Mitternacht.
- **Normalwoche-Einträge** für heute nur, solange sie noch kommen (z. B. „Anna holt um 14 Uhr“ verschwindet nach 14 Uhr). **Offene Slots (Essen offen, Bett offen) erscheinen auf Heute gar nicht**, nur wenn jemand sie übernommen hat.
- **„Demnächst“**: mehrtägige Ereignisse der nächsten 7 Tage (z. B. „So–Di · Valerie bei Oma“)
- Alle anderen Aufgaben gehören **nicht** auf Heute, sondern in To-Dos.

**Zeitstrahl (rechts, volle Höhe bis zur unteren Leiste)**
- Schmale Röhre, 6–22 Uhr, kleine Striche jede Stunde, Zahlen alle 3 Stunden
- **Füllstand** von oben bis jetzt (graublau), mit klarer brauner Kante, kleinem Punkt auf der Kante und der Uhrzeit daneben. **Kein extra „jetzt“-Strich.** Aktualisiert sich minütlich.
- **Gold** = Valerie ist betreut (Kita/Oma/Theresa), **Navy** = Termine. Keine Beschriftung in der Röhre nötig.

### Woche (Vorlage: Woche2)
- Kopf mit Pfeilen ‹ › zum **beliebig weit Blättern**, Datum und KW
- Reiter: **Diese Woche · Nächste Woche · Normalwoche**
- Pro Tag eine kurze Zeile in Handschrift, antippen klappt Details auf (wie bisher)
- **Mehrtägige Ereignisse als senkrechte Streifen am rechten Rand** über die betroffenen Tage, mit Beschriftung. Wenn sie in die Woche hinein- oder hinauslaufen, oben bzw. unten offen.
- Wiederholungen mit ↻ markieren
- **Offene Slots** (Essen/Bett/Familientag) nur hier, gestrichelt mit „übernehmen“. Antippen = ich übernehme (oder wähle Anna).
- Eintragen: Termin, mehrtägiges Ereignis, Wiederholung, Personen inkl. **Oma** und **Theresa**

### To-Dos (Vorlage: ToDos)
- Reiter Max · Anna · Alle
- Gruppen: **Neu** · **Heute fällig** · **Diese Woche** · **Später** · **Geschafft diese Woche**
- NEU-Stempel bis angesehen
- Erledigte bleiben bis Sonntag 20 Uhr durchgestrichen sichtbar, danach unter **„Erledigt ansehen“** (nach Woche gruppiert)

---

## Fertig ist v2, wenn

- [ ] Anna trägt eine Aufgabe für Max ein → Max bekommt sofort eine Mitteilung mit Inhalt, in der App steht NEU
- [ ] Morgenbriefing kommt zur eingestellten Zeit und entfällt, wenn man schon reingeschaut hat
- [ ] Heute zeigt nur Heutiges, Vergangenes verschwindet, offene Slots erscheinen nicht
- [ ] Zeitstrahl füllt sich, volle Höhe, Gold/Navy korrekt
- [ ] Satz des Tages: verborgen, eine Kategorie pro Tag, ein-/ausblendbar
- [ ] Woche: beliebig blättern, drei Reiter, Streifen für mehrtägige Ereignisse, Wiederholungen
- [ ] To-Dos mit Gruppen und Archiv
- [ ] Oma und Theresa als Personen wählbar

Am Ende: kurze Zusammenfassung für Max in einfachen Worten.
