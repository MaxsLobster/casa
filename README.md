# Casa – Notizbuch für zwei

Gemeinsames Notizbuch für Max und Anna als Web-App (PWA) für iPhone, iPad und Mac.

- **Frontend:** Vite + React + TypeScript, PWA mit eigenem Service Worker (`src/sw.ts`)
- **Backend:** Supabase (Postgres, Magic-Link/Code-Login, Row Level Security, Realtime)
- **Hosting:** GitHub Pages über `.github/workflows/deploy.yml`
- **Einrichtung:** siehe [SETUP.md](SETUP.md)
- **Auftrag Phase 1:** [casa-auftrag-phase-1.md](casa-auftrag-phase-1.md), Design-Entwürfe in `design-referenz/`

## Aufbau

```
src/
  lib/        Typen, Datumshelfer, Normalwochen-Logik, Datenzugriff (Supabase oder lokaler Demo-Modus)
  state/      Haushalt/Session (CasaProvider), Dunkelmodus
  components/ Navigation, Bausteine (Stempel, Chips, Sheet, …)
  screens/    Heute, Woche, Offen, Neu, Sonntag (Platzhalter), Einstellungen, Login
  styles/     global.css (Papier, Farben, Dunkelmodus, Layout)
supabase/
  migrations/ Schema (Tabellen, RLS, Login-Trigger) und Startdaten (Normalwoche)
```

## Befehle

```bash
npm run dev        # Entwicklung unter http://localhost:5173/casa/
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run typecheck  # nur Typprüfung
```

Ohne `.env.local` (siehe `.env.example`) läuft die App im Demo-Modus mit Daten im Browser.
