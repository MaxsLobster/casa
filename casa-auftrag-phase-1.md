# Casa – Auftrag für Claude Code (Phase 1)

Hi Claude Code. Wir bauen **Casa**: ein gemeinsames Notizbuch für Max und Anna (Ehepaar, eine Tochter: Valerie, 4). Eine Web-App (PWA) für iPhone, iPad und Mac. Sprache der App: Deutsch.

Bitte erst **diese Datei komplett lesen**, dann mir (Max) kurz deinen Plan zeigen, dann bauen. Erkläre mir Schritte, die ich selbst machen muss (z. B. bei Supabase), einfach und einzeln.

---

## 1. Worum es geht

- Ziel: Nichts bleibt mehr hängen, keiner muss dem anderen hinterherlaufen. **Die App ersetzt das Nachhaken, nicht das Reden.**
- Grundregel: **Jede Aufgabe hat genau eine zuständige Person (Max oder Anna) und ein Datum.** Kein „irgendwann“, kein „beide“ bei Aufgaben.
- Termine dürfen „Max“, „Anna“ oder „beide“ sein.
- Es gibt eine feste **Normalwoche** (wer bringt/holt Valerie, wer macht den Abend). Eingetragen werden nur Abweichungen.
- Ton: ruhig, freundlich, positiv. **No-Gos:** keine Punkte, Zähler, Streaks oder Strafen, keine roten Warnungen, keine Mitteilungen in Ruhezeiten.

---

## 2. Technik

- **Frontend:** Vite + React + TypeScript, als PWA (Manifest, Service Worker, „Zum Home-Bildschirm“ muss sauber funktionieren, eigenes Icon, Vollbild ohne Browserleiste)
- **Backend:** Supabase (Postgres, Auth, Row Level Security). Max hat einen Supabase-Account bzw. legt ihn an. Führe ihn durch das Verknüpfen (Supabase CLI).
- **Hosting:** GitHub Pages, Repo `MaxsLobster/casa`, Deploy per GitHub Action
- **Login:** Jeder hat einen eigenen Login per E-Mail-Link (Magic Link). **Nur zwei erlaubte E-Mail-Adressen** (Max und Anna, frage Max danach). Nach dem ersten Login bleibt man eingeloggt.
- **Sicherheit:** RLS auf allen Tabellen, nur Mitglieder des Haushalts sehen Daten. Nur den anon key im Frontend, den service role key niemals ins Repo. Secrets über GitHub/Supabase Secrets.
- **Erweiterbar bauen:** Alles hängt an einem `household`. Später kommen evtl. weitere Personen (Familie) und weitere Bereiche dazu (siehe Abschnitt 7). Das Datenmodell soll das ohne Umbau zulassen.
- Service Worker jetzt schon so anlegen, dass in Phase 3 Web Push dazukommen kann.

---

## 3. Umfang Phase 1 (nur das bauen!)

1. Projekt-Setup, Supabase verknüpft, Deploy auf GitHub Pages läuft
2. Login (Magic Link, nur 2 Adressen)
3. Datenbank für Phase 1 + vorbereitete Struktur für später (siehe Abschnitt 5)
4. Screens: **Heute**, **Woche**, **Offen**, **Neu (+)**
5. Normalwoche mit Annas Plan vorbefüllt (siehe Abschnitt 6)
6. Hell/Dunkel: ab 20:00 automatisch dunkles Notizbuch, in den Einstellungen abschaltbar
7. Responsiv: Handy zuerst; ab Tablet-Breite **zweispaltig** (z. B. Heute links, Woche rechts), damit man es zu zweit am iPad anschauen kann

**Nicht in Phase 1:** Fragen an den anderen, „Ich kann nicht“, Push-Mitteilungen, Sonntagsrunde, Parkplatz für Ideen, Verträge. Die Navigation darf den Tab „Sonntag“ schon zeigen (Platzhalter „kommt bald“).

---

## 4. Screens

Untere Leiste (fix): **Heute · Woche · [+] · Offen · Sonntag**. Der Inhalt darüber scrollt.

**Heute**
- Kopf: nur eine Zeile, z. B. „Montag, 19. Oktober“ (Handschrift). Nicht mehr.
- Darunter zwei Zeilen aus der Normalwoche (inkl. Abweichungen): „Valerie: du bringst, Oma holt um 14 Uhr“ und „Abend: du kochst, Anna bringt ins Bett“. Aus Sicht des eingeloggten Nutzers formuliert („du“).
- Darunter ausklappbare Listen, **immer nur eine offen**: „Termine heute“, „Für dich“, „Bei Anna“ (bzw. „Bei Max“), „Geschafft diese Woche“. Rechts die Anzahl.
- (Ab Phase 2 kommt oben ein Klebezettel mit offenen Fragen. Platz dafür einplanen.)

**Woche**
- Zwei Reiter: **Diese Woche** (mit Datum, Kalenderwoche) und **Normalwoche** (die Vorlage).
- Pro Tag eine kurze Zeile (z. B. „Mo: Oma holt · du kochst“), antippen klappt Details auf: Valerie, Anna/Arbeit, Abend, Termine des Tages, jeweils eigene Zeile.
- Offene Punkte (z. B. „Essen offen“) als kleiner goldener Kreis rechts, im aufgeklappten Tag als kursiver Hinweis.
- Heute ist hervorgehoben und standardmäßig aufgeklappt.
- In „Diese Woche“ kann man einen Tag antippen und eine **Abweichung** für einen Eintrag setzen (z. B. „Mittwoch holt Max statt Theresa“) oder einen Termin hinzufügen.
- In „Normalwoche“ kann man die Vorlage bearbeiten.
- Das ist gleichzeitig **unser gemeinsamer Kalender**: Termine beider sind für beide sichtbar.

**Offen**
- Reiter: Max · Anna · Alle
- Pro Aufgabe: Kreis zum Abhaken, Titel in Handschrift, darunter klein ein Stempel (Status + Datum, z. B. „ZUGESAGT · FR“). Bei „Alle“ zusätzlich der Name.
- Status: offen · zugesagt · geparkt · erledigt. Erledigtes rutscht nach unten, durchgestrichen.
- Antippen öffnet Details zum Bearbeiten (Titel, wer, Datum, Status, Notiz).

**Neu (+)**
- Oben Reiter: **Aufgabe** · **Termin** (Frage und Idee kommen in Phase 2/4)
- Großes Textfeld in Handschrift-Optik, Mikrofon-Knopf (nutzt vorerst einfach die iOS-Diktierfunktion der Tastatur, kein eigenes Spracherkennungssystem)
- „Wer?“ als Chips: Aufgabe → Max | Anna. Termin → Max | Anna | Beide
- „Wann?“ als Chips: Heute · Morgen · Freitag · Nächste Woche · Datum …; bei Terminen zusätzlich Uhrzeit (optional)
- Speichern-Knopf erst aktiv, wenn Wer und Wann gesetzt sind („Wer und wann fehlen noch“)

---

## 5. Datenmodell (Vorschlag, gern verbessern)

- `households` (id, name)
- `members` (id, household_id, user_id, display_name, role) – erstmal Max und Anna
- `tasks` (id, household_id, title, owner_member_id **NOT NULL**, due_date **NOT NULL**, status, note, created_by, created_at, done_at)
- `events` (id, household_id, title, date, start_time, end_time, who: max/anna/both, note, created_by)
- `normal_week` (id, household_id, weekday, slot, value, is_open, note) – Slots z. B. `valerie_bringen`, `valerie_holen`, `anna_arbeit`, `nachmittag`, `abend_essen`, `abend_bett`
- `week_overrides` (id, household_id, date, slot, value, note, created_by)
- `settings` pro Mitglied (dark_mode_auto, quiet_hours_start, quiet_hours_end) – Ruhezeiten werden ab Phase 3 genutzt

Für später nur vorsehen, noch nicht bauen: `requests` (Phase 2), `push_subscriptions` (Phase 3), `ideas` (Phase 4), `contracts` (Phase 5).

---

## 6. Normalwoche (Annas Plan, so vorbefüllen)

- **Montag:** Valerie: Max bringt, Oma holt 14:00 · Anna: Arbeit 8 Std. · Abend: Max kocht, Anna bringt ins Bett
- **Dienstag:** Valerie: Max bringt, Anna holt 14:00 · Anna: Arbeit 4 Std. · Abend: Anna kocht, Bettgehen vorerst Anna
- **Mittwoch:** Valerie: Max bringt, Theresa holt 14:00 und betreut (kann sie nicht, übernimmt Max) · Anna: Arbeit 8 Std. · Abend: Essen **offen**, Anna bringt ins Bett
- **Donnerstag:** Valerie: Max bringt, Anna holt 13:00 · Nachmittag: Turnen 15–16 Uhr, danach Freunde · Abend: Essen bei Freunden, Anna bringt ins Bett
- **Freitag:** Valerie: Max bringt, Anna holt 14:00 · Anna: freier Tag · Abend: Essen und Bettgehen **offen**
- **Wochenende:** Ein Familientag, ein Tag mit geteilter Betreuung, flexibel · welcher Tag Familientag ist: **offen**

Unterzeile der Normalwoche: „Orientierung, kein starres Regelwerk. Offenes klären wir in der Sonntagsrunde.“

---

## 7. Spätere Phasen (nur zur Orientierung, NICHT bauen)

- **Phase 2 – Fragen & „Ich kann nicht“:** Frage an den anderen; Antwort „Ja, gern“ / „Lieber nicht“ / „Später“ + freie Notiz + Schnell-Notizen. Kein Zeitdruck. Offene Fragen liegen oben auf „Heute“ als Klebezettel. „Ich kann nicht“ an jedem Eintrag der Normalwoche → erzeugt automatisch eine Frage an den Partner.
- **Phase 3 – Push:** Web Push (VAPID) über Supabase Edge Functions + Zeitplan (pg_cron). Neue Frage → sofort; Antwort → sofort; offene Fragen → einmal täglich erinnern, bis beantwortet; morgens nur, wenn heute etwas fällig ist; Sonntag 20:00 → „Sonntagsrunde“. Ruhezeiten pro Person einstellbar, Standard nachts still; was in der Ruhezeit anfällt, kommt gesammelt danach.
- **Phase 4 – Sonntagsrunde (Sonntag 20:00) & Parkplatz:** Füllt sich selbst: 1. Was wir geschafft haben, 2. Was noch zu klären ist (offene Punkte, unbeantwortete Fragen, Überfälliges), 3. Ideen vom Parkplatz, 4. Beschlüsse → mit einem Tipp zur Aufgabe.
- **Phase 5 – Verträge:** Versicherungen, Strom/Gas, Internet/Handy, Abos, Geldanlagen. Pro Eintrag: was, bei wem, Kosten/Monat, läuft bis, Kündigungsfrist, zuständig, Status (passt/prüfen/kündigen). 8 Wochen vor Kündigungsfrist automatisch Aufgabe. **Keine Policennummern, IBANs oder Zugangsdaten speichern.**
- **Irgendwann:** Abend-Check, Familien-Dashboard mit Großeltern, Kalender-Feed (.ics) für die iPhone-Kalender-App, Brief fotografieren → Aufgabe.

---

## 8. Design: „Notizbuch für zwei“

Referenz: die beigelegten Entwürfe (`design-referenz/*.dc.html`). Das sind Mockups für einen Design-Editor. Bitte **nur Optik und Aufbau übernehmen**, nicht deren Technik (`support.js`, `<x-dc>`, `DCLogic` usw. gibt es bei uns nicht).

- **Papier:** `#F4F1EA`, feines Punktraster wie bei einem Leuchtturm-Notizbuch (`radial-gradient` Punkte, ca. 19 px Abstand, sehr dezent)
- **Perforation:** gestrichelte senkrechte Linie links (ca. 22 px vom Rand)
- **Farben:** Tinte `#1D1D1B`, Navy `#1F2A44` (Akzent, Knöpfe), Gold `#B08A45` (Valerie, Markierungen), Braun `#6B5222` (Hinweise), Grau `#6E6A60` (Beschriftungen), Klebezettel `#EFE4C8`, Grün `#2F5D3A` nur für „erledigt“
- **Schriften (Google Fonts):** *Newsreader* für Oberfläche und Beschriftungen (kleine Großbuchstaben-Labels mit Sperrung), *Caveat* für alles, was wir eintragen (Aufgaben, Termine, Titel)
- **Stempel:** kleine Großbuchstaben mit dünnem Rahmen, nicht schräg, unter dem Text (nicht daneben, sonst Überlappung)
- **Dunkelmodus (ab 20:00):** dunkles Navy-Papier, helle Tinte, gleiche Struktur
- **Regeln:** ruhig, viel Luft, nichts überladen. Kopfzeilen maximal eine Zeile. Lange Texte umbrechen, nie überlappen. Touch-Ziele mindestens 44 px. Keine Emojis, keine Verläufe.
- **Kleine Animationen** (dezent, kurz): Abhaken setzt den Stempel mit leichtem „Aufdrück“-Effekt; Aufklappen weich.

---

## 9. Fertig ist Phase 1, wenn

- [ ] Max und Anna sich jeweils per E-Mail-Link einloggen können, andere Adressen nicht
- [ ] Die App auf dem iPhone über „Zum Home-Bildschirm“ wie eine App startet
- [ ] Die Normalwoche vorbefüllt ist und in „Woche“ korrekt angezeigt wird, inkl. offener Punkte
- [ ] Abweichungen und Termine gespeichert werden und beim anderen sofort (bzw. nach Neuladen) sichtbar sind
- [ ] Aufgaben nur mit Person + Datum angelegt werden können und in „Offen“ und „Heute“ erscheinen
- [ ] Abhaken funktioniert und in „Geschafft diese Woche“ auftaucht
- [ ] Dunkelmodus ab 20:00 greift und abschaltbar ist
- [ ] Ab Tablet-Breite zweispaltig
- [ ] Deploy auf GitHub Pages läuft automatisch

Am Ende: kurze Zusammenfassung für Max in einfachen Worten, was fertig ist, wie er es auf dem iPhone testet und was er Anna schicken muss. Dann **stoppen** – Phase 2 kommt mit einem eigenen Auftrag.
