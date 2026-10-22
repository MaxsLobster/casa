# Casa einrichten – Schritt für Schritt

Das hier ist deine Checkliste, Max. Jeder Schritt ist für sich erledigt, bevor der nächste kommt.
Alles, was du selbst machen musst, ist mit **[Du]** markiert.

Die App läuft am Ende hier: **https://maxslobster.github.io/casa/**

Lokal ohne `.env.local` läuft die App im **Demo-Modus** (Daten nur im eigenen Browser, Login mit `max@beispiel.de` oder `anna@beispiel.de`).

---

## Stand (22.10.2026)

Erledigt per CLI: Projekt verknüpft, Schema und Startdaten eingespielt (mit euren Adressen), Site-URL und Redirect-URLs gesetzt, GitHub-Secrets gesetzt, Deploy läuft mit Supabase.

**Noch offen: der Mail-Versand (Teil A5).** Ohne eigenen SMTP-Versand erlaubt Supabase im Free-Tarif keine eigenen Mail-Vorlagen, also auch keinen Code in der Mail. Dann kommt nur der Link, und der öffnet auf dem iPhone Safari statt der Casa-App. Am Mac und im Safari auf dem iPhone funktioniert der Link-Login trotzdem.

---

## Teil A – Supabase

### A1–A4 · erledigt

Projekt `casa` (Frankfurt), Datenbank, Adressen, URL-Konfiguration: alles eingespielt. Zum Nachsehen: **SQL Editor** oder **Table Editor** im Dashboard, dort stehen `households`, `members`, `tasks`, `events`, `normal_week`, `week_overrides`, `settings`.

### A5 · Eigener Mail-Versand über dein Gmail  [Du]

Damit die Login-Mail einen Code enthält (und zuverlässig auch bei Anna ankommt), schickt Supabase die Mails über dein Gmail-Konto. Dafür brauchst du ein **App-Passwort** von Google:

1. https://myaccount.google.com/apppasswords öffnen (falls es sagt, du brauchst die Bestätigung in zwei Schritten: unter **Sicherheit** erst „Bestätigung in zwei Schritten“ einschalten, dann nochmal).
2. Name eingeben, z. B. `Casa Supabase` → **Erstellen**. Google zeigt ein 16-stelliges Passwort.
3. Dieses Passwort (ohne Leerzeichen) in die Datei `supabase/.env` im Projektordner eintragen, hinter `SMTP_PASS=`. Die Datei wird nicht ins Repo geladen.
4. Mir Bescheid geben. Ich schalte dann SMTP und die Mail-Vorlagen per CLI ein (`supabase config push`).

Wenn du dein Gmail dafür nicht nutzen willst: Ein kostenloses Brevo-Konto (brevo.com, Absender verifizieren, SMTP-Schlüssel erzeugen) geht genauso; dann trage ich die Brevo-Daten statt Gmail ein.

### A6 · Falls Annas Mail nicht ankommt  [Du]

Bis A5 erledigt ist, verschickt Supabase nur wenige Mails pro Stunde und je nach Einstellung nur an Mitglieder deiner Supabase-Organisation. Notlösung: Im Dashboard oben links auf die Organisation → **Team** → **Invite** → Annas Adresse (Rolle „Read-only“). Mit A5 entfällt das.

### A7 · Schlüssel  · erledigt

Project-URL und anon-Key stehen in `.env.local` (lokal) und als GitHub-Secrets. Der `service_role`-Key wird nirgends verwendet.

---

## Teil B – GitHub  · erledigt

Secrets gesetzt, Deploy angestoßen. Für später:

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && gh workflow run "Deploy auf GitHub Pages"
```

Status: https://github.com/MaxsLobster/casa/actions

---

## Teil C – Auf dem iPhone testen  [Du]

1. In **Safari** https://maxslobster.github.io/casa/ öffnen.
2. **Teilen-Knopf** (Viereck mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App vom Home-Bildschirm öffnen (startet ohne Browserleiste, mit eigenem Icon).
4. Deine E-Mail-Adresse eintippen → **Link schicken**.
5. Mail öffnen, den **Code** merken, zurück in die Casa-App, Code eintippen → **Anmelden**. (Code gibt es erst nach A5; bis dahin öffnet der Link die App in Safari.)
6. Du bleibst eingeloggt, auch nach Neustart.

Was Anna bekommt: den Link https://maxslobster.github.io/casa/ und die drei Sätze „Safari → Teilen → Zum Home-Bildschirm. Dann mit deiner Mail-Adresse anmelden, Code aus der Mail eintippen.“

---

## Teil D – Lokal entwickeln

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && npm run dev
```

Dann http://localhost:5173/casa/ öffnen. Ohne `.env.local` läuft der Demo-Modus.

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && npm run build
```

baut die fertige App nach `dist/`.
