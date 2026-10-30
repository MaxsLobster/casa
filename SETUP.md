# Casa einrichten – Schritt für Schritt

Das hier ist deine Checkliste, Max. Jeder Schritt ist für sich erledigt, bevor der nächste kommt.
Alles, was du selbst machen musst, ist mit **[Du]** markiert.

Die App läuft am Ende hier: **https://maxslobster.github.io/casa/**

Lokal ohne `.env.local` läuft die App im **Demo-Modus** (Daten nur im eigenen Browser, Login mit `max@beispiel.de` oder `anna@beispiel.de`).

---

## Stand (22.10.2026)

Alles per CLI erledigt: Projekt verknüpft, Schema und Startdaten eingespielt, eure zwei Konten angelegt (bestätigt, ohne Mail), Registrierung für andere gesperrt, Site-URL gesetzt, GitHub-Secrets gesetzt, Deploy läuft mit Supabase.

**Login = E-Mail + Passwort.** Kein Mail-Versand, keine Codes.

---

## Teil A – Supabase  · erledigt

Zum Nachsehen im Dashboard: **Authentication → Users** zeigt die zwei Konten, **Table Editor** die Tabellen `households`, `members`, `tasks`, `events`, `normal_week`, `week_overrides`, `settings`.

### Passwort festlegen (einmalig)  [Du und Anna]

Jeder legt sein Passwort selbst fest, über einen **Einmal-Link**, den die CLI ohne Mail erzeugt:

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && supabase --help >/dev/null && echo "Link bitte von Claude erzeugen lassen (siehe unten)"
```

Der Link öffnet die App mit dem Screen „Leg dein Passwort fest“. Er gilt **eine Stunde** und nur einmal. Abgelaufen? Einfach neu erzeugen lassen. Danach: in der App (auch vom Home-Bildschirm) mit E-Mail + Passwort anmelden, man bleibt eingeloggt.

Technisch: `POST /auth/v1/admin/generate_link` mit `type: "recovery"` und dem `service_role`-Key, der nur lokal in der CLI verwendet wird und nie ins Repo kommt.

### Passwort ändern oder vergessen

- Ändern: in der App unter **Einstellungen → Passwort ändern**.
- Vergessen: neuen Einmal-Link erzeugen lassen (wie oben), oder im Dashboard unter **Authentication → Users** beim Konto ein neues Passwort setzen.

### Schlüssel  · erledigt

Project-URL und anon-Key stehen in `.env.local` (lokal) und als GitHub-Secrets. Der `service_role`-Key wird nur lokal für Admin-Aufgaben benutzt.

---

## Teil B – GitHub  · erledigt

Secrets gesetzt, Deploy läuft bei jedem Push auf `main`. Manuell anstoßen:

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && gh workflow run "Deploy auf GitHub Pages"
```

Status: https://github.com/MaxsLobster/casa/actions

---

## Mitteilungen (v2, Schritt 1)  [Du und Anna]

Casa schickt Push-Mitteilungen, wenn der andere etwas für einen einträgt, plus ein Morgenbriefing. Damit sie ankommen, muss **jedes Gerät einmal angemeldet** werden:

1. **Casa vom Home-Bildschirm starten** (nicht in Safari). Falls das Icon noch fehlt: Safari → https://maxslobster.github.io/casa/ → Teilen → „Zum Home-Bildschirm“.
2. Einmal ganz schließen und neu öffnen, damit die aktuelle Version geladen ist.
3. Unten auf **Heute**, ganz unten **Einstellungen** → **Mitteilungen aktivieren** → im iPhone-Dialog **Erlauben**.
4. **Test-Mitteilung senden** antippen. Nach ein paar Sekunden kommt „Casa – Test geglückt“.
5. Optional: Uhrzeit fürs **Morgenbriefing** (Standard 7:00) und **Ruhezeit** (Standard aus) einstellen.

Voraussetzung: iOS 16.4 oder neuer. Steht in den iPhone-Einstellungen unter Mitteilungen → Casa alles auf „Erlauben“, kommen sie auch bei gesperrtem Bildschirm.

Technik dahinter: Datenbank-Trigger legen Mitteilungen in `notifications` ab, pg_cron prüft minütlich (Briefing, Versand), die Edge Function `send-push` verschickt per Web Push (VAPID-Schlüssel als Supabase-Secrets, öffentlicher Teil als `VITE_VAPID_PUBLIC_KEY`). Nach eigenen Einträgen stößt die App den Versand sofort an.

Nachsehen, was verschickt wurde:

```bash
cd /Users/maximilianarmborst/Desktop/casa-start && supabase db query --linked "select created_at, kind, title, body, sent_at, error from public.notifications order by created_at desc limit 10"
```

---

## Teil C – Auf dem iPhone testen  [Du]

1. In **Safari** https://maxslobster.github.io/casa/ öffnen.
2. **Teilen-Knopf** (Viereck mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App vom Home-Bildschirm öffnen (startet ohne Browserleiste, mit eigenem Icon).
4. E-Mail-Adresse und Passwort eintippen → **Anmelden**. Du bleibst eingeloggt, auch nach Neustart.

Was Anna bekommt: ihren Einmal-Link zum Passwort-Festlegen (am Mac oder iPhone öffnen, Passwort setzen), dann den Link https://maxslobster.github.io/casa/ mit „Safari → Teilen → Zum Home-Bildschirm, dann mit E-Mail und Passwort anmelden.“

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
