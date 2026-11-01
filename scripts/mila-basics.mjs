// Mila · Basis-Markierung aufräumen (Max, 1.11.2026):
// Als Basis gelten nur Salz, Pfeffer, Öl, Essig, Zucker, Mehl und trockene Gewürze.
// Alles andere wird auf „kaufen“ gesetzt. Das Skript stuft nur ab, nie hoch.
//
//   node scripts/mila-basics.mjs
//
// Schreibt src/mila/seed.json (Demo) und supabase/migrations/20261101120000_mila_basis_aufraeumen.sql (live).

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const seedPath = path.join(root, 'src/mila/seed.json')
const sqlPath = path.join(root, 'supabase/migrations/20261101120000_mila_basis_aufraeumen.sql')

// Trockene Gewürze und Grundzutaten, die auch einzeln als Basis zählen
const BASIC = [
  /salz/, /pfeffer/, /öl\b/, /essig/, /balsamico/, /zucker/, /mehl/,
  /paprika/, /kreuzkümmel/, /koriander/, /kurkuma/, /zimt/, /garam masala/, /chili/, /cayenne/,
  /piment/, /lorbeer/, /oregano/, /muskat/, /nelken/, /kardamom/, /sternanis/, /fenchelsamen/,
  /knoblauchpulver/, /zwiebelpulver/, /senfpulver/, /amchur/, /vanille/, /gewürz/,
  /^wasser$/, /küchengarn/,
]
// Frische Ware, die trotz Treffer oben nicht als Basis gilt
const FRESH = [/vogelaugen/, /frisch/, /basilikum/, /petersilie/, /thymian/, /rosmarin/]

/** Jede Teilzutat („Olivenöl, Salz, Pfeffer“, „Zimt + Piment“, „A oder B“) muss Basis sein */
export function isBasic(name) {
  const parts = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s*(?:,|\+|\boder\b|\bund\b)\s*/)
    .map((p) => p.replace(/\boptional\b|\bopt\.?/g, '').trim())
    .filter(Boolean)
  if (!parts.length) return false
  return parts.every((p) => !FRESH.some((f) => f.test(p)) && BASIC.some((b) => b.test(p)))
}

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'))
const demoted = []
const kept = []
for (const r of recipes) {
  for (const i of r.ingredients) {
    if (!i.pantry_basic) continue
    if (isBasic(i.name)) kept.push(i.name)
    else {
      i.pantry_basic = false
      demoted.push({ id: i.id, name: i.name, recipe: r.name })
    }
  }
}

writeFileSync(seedPath, JSON.stringify(recipes, null, 1) + '\n')

const sql = [
  '-- Mila · Basis-Markierung aufräumen (Max, 1.11.2026):',
  '-- Als Basis gelten nur Salz, Pfeffer, Öl, Essig, Zucker, Mehl und trockene Gewürze.',
  '-- Alles andere auf „kaufen“. Erzeugt von scripts/mila-basics.mjs, stuft nur ab.',
  '',
  'update public.mila_ingredients set pantry_basic = false where id in (',
  demoted.map((d, i) => `  '${d.id}'${i < demoted.length - 1 ? ',' : ' '} -- ${d.name.replace(/'/g, "''")} (${d.recipe.replace(/'/g, "''")})`).join('\n'),
  ');',
  '',
]
writeFileSync(sqlPath, sql.join('\n'))

const uniq = (a) => [...new Set(a)].sort((x, y) => x.localeCompare(y, 'de'))
console.log(`Bleibt Basis (${uniq(kept).length} Namen):\n  ` + uniq(kept).join('\n  '))
console.log(`\nAuf „kaufen“ (${demoted.length} Zutaten, ${uniq(demoted.map((d) => d.name)).length} Namen):\n  ` + uniq(demoted.map((d) => d.name)).join('\n  '))
