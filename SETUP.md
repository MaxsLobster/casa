# Casa einrichten – Schritt für Schritt

Das hier ist deine Checkliste, Max. Jeder Schritt ist für sich erledigt, bevor der nächste kommt.
Alles, was du selbst machen musst, ist mit **[Du]** markiert.

Die App läuft am Ende hier: **https://maxslobster.github.io/casa/**

Solange Supabase noch nicht verbunden ist, läuft die App im **Demo-Modus**
(Daten nur im eigenen Browser, Login mit `max@beispiel.de` oder `anna@beispiel.de`).
Damit kannst du schon mal alles anschauen.

---

## Teil A – Supabase (Datenbank und Login)

### A1 · Projekt anlegen  [Du]

1. Auf https://supabase.com einloggen (oder Account anlegen).
2. **New project** → Name `casa`, Region **Frankfurt (eu-central-1)**, ein Datenbank-Passwort vergeben (irgendwo sicher notieren, du brauchst es selten).
3. Warten, bis das Projekt fertig ist (ca. 1–2 Minuten).

### A2 · E-Mail-Adressen eintragen  [Du]

Öffne die Datei `supabase/migrations/20261021100100_phase1_seed.sql` und trage ganz oben die beiden Adressen ein:

```sql
  max_email  text := 'max@beispiel.de';    -- <<< Max' Adresse
  anna_email text := 'anna@beispiel.de';   -- <<< Annas Adresse
```

Nur diese zwei Adressen können sich später einloggen. Andere werden abgelehnt.

### A3 · Datenbank einrichten  [Du]

**Weg 1 – im Browser (einfachster Weg):**

1. Im Supabase-Dashboard links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von `supabase/migrations/20261021100000_phase1_schema.sql` einfügen → **Run**. Es sollte „Success“ stehen.
3. Neue Query: den Inhalt von `supabase/migrations/20261021100100_phase1_seed.sql` einfügen (mit euren Adressen) → **Run**.

**Weg 2 – per Terminal (Supabase CLI ist schon installiert):**

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && supabase login
```

(öffnet den Browser, dort bestätigen)

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && supabase link --project-ref DEINE-PROJEKT-REF
```

Die Projekt-Ref findest du im Dashboard unter **Project Settings → General** (so was wie `abcdefghijklmnop`). Es fragt nach dem Datenbank-Passwort von A1.

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && supabase db push
```

Damit werden beide SQL-Dateien eingespielt.

### A4 · Login-Adressen für die App freigeben  [Du]

Im Dashboard: **Authentication → URL Configuration**

- **Site URL:** `https://maxslobster.github.io/casa/`
- **Redirect URLs** (beide hinzufügen):
  - `https://maxslobster.github.io/casa/**`
  - `http://localhost:5173/casa/**`

### A5 · E-Mail-Vorlage mit Code  [Du]

Wichtig fürs iPhone: Wenn man in der Mail auf den Link tippt, öffnet sich Safari – nicht die Casa-App vom Home-Bildschirm. Deshalb steht in der Mail zusätzlich ein **6-stelliger Code**, den man in der App eintippt.

Im Dashboard: **Authentication → Email Templates**. Bitte **beide** Vorlagen **Confirm signup** und **Magic Link** so setzen:

Betreff: `Dein Casa-Code: {{ .Token }}`

Inhalt:

```html
<h2>Casa</h2>
<p>Dein Code zum Anmelden:</p>
<p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
<p>Gib ihn in der Casa-App ein. Oder tipp hier, wenn du am Mac bist: <a href="{{ .ConfirmationURL }}">Anmelden</a></p>
<p>Der Code gilt eine Stunde.</p>
```

### A6 · Falls Annas Mail nicht ankommt  [Du]

Supabase verschickt ohne eigenen Mail-Server nur wenige Mails pro Stunde und je nach Einstellung nur an Mitglieder deiner Supabase-Organisation. Darum:

- Im Dashboard oben links auf die Organisation → **Team** → **Invite** → Annas Adresse (Rolle „Read-only“ reicht).
- Alternative für später: eigenen SMTP-Versand eintragen (**Project Settings → Auth → SMTP**), z. B. mit einem kostenlosen Resend-Konto.

### A7 · Schlüssel holen  [Du]

**Project Settings → API** (bzw. **API Keys**):

- **Project URL** – so was wie `https://abcdefgh.supabase.co`
- **anon public** Key (bei neueren Projekten heißt er „publishable key“ und beginnt mit `sb_publishable_…`; beide funktionieren)

Den **service_role** Key brauchst du nicht. Der kommt nirgends hin.

Für die lokale Entwicklung: Datei `.env.local` im Projektordner anlegen (Vorlage: `.env.example`) und beide Werte eintragen. Diese Datei wird nicht ins Repo geladen.

---

## Teil B – GitHub (Veröffentlichen)

Das Repo `MaxsLobster/casa` existiert schon, der Deploy läuft automatisch bei jedem Push auf `main`.
Damit die veröffentlichte App Supabase kennt, brauchen die GitHub Actions die zwei Werte aus A7 als Secrets:

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && gh secret set VITE_SUPABASE_URL
```

(fragt den Wert ab, einfügen, Enter)

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && gh secret set VITE_SUPABASE_ANON_KEY
```

Danach den Deploy einmal neu anstoßen:

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && gh workflow run "Deploy auf GitHub Pages"
```

Nach 1–2 Minuten ist https://maxslobster.github.io/casa/ aktuell. Status: https://github.com/MaxsLobster/casa/actions

---

## Teil C – Auf dem iPhone testen  [Du]

1. In **Safari** https://maxslobster.github.io/casa/ öffnen.
2. **Teilen-Knopf** (Viereck mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App vom Home-Bildschirm öffnen (startet ohne Browserleiste, mit eigenem Icon).
4. Deine E-Mail-Adresse eintippen → **Link schicken**.
5. Mail öffnen, den **Code** merken, zurück in die Casa-App, Code eintippen → **Anmelden**.
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
