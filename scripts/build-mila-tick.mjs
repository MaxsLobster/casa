// Bündelt die Mila-Rechnung (src/mila/engine.ts) für die Edge Function „mila-tick“ in eine Datei ohne Abhängigkeiten.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/mila/tick-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: 'supabase/functions/mila-tick/engine.js',
  banner: { js: '// Automatisch erzeugt aus src/mila/engine.ts mit `npm run build:mila-tick`. Nicht von Hand ändern.' },
  logLevel: 'info',
})
