// Bündelt die geteilte Rechnung (Einkaufszettel, Freizeit-Termin) für die Edge Function „manager“.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/manager/shared-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: 'supabase/functions/manager/shared.js',
  banner: { js: '// Automatisch erzeugt aus src/manager/shared-entry.ts mit `npm run build:manager`. Nicht von Hand ändern.' },
  logLevel: 'info',
})
