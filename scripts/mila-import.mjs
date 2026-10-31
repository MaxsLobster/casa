// Mila · Rezept-Umzug aus der alten Mila-App.
//
//   node scripts/mila-import.mjs
//
// Liest scripts/mila-seed-alt.js (Kopie von MaxsLobster/mila-app, src/db/seed.js)
// und schreibt:
//   supabase/migrations/20261101100100_mila_rezepte.sql   Daten für die echte Datenbank
//   src/mila/seed.json                                     dieselben Daten für den Demo-Modus
//   mila-briefing/UMZUG-unsicher.md                        Liste der unsicheren Umwandlungen
//
// Läuft nur hier am Mac, nie in der App.

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shop = JSON.parse(readFileSync(path.join(root, 'src/mila/shop-rules.json'), 'utf8'))

// ---------------------------------------------------------------------------
// Alte Seed-Datei lesen: nur das Array SEED_RECIPES, ohne die Datenbank-Importe
// ---------------------------------------------------------------------------

const srcText = readFileSync(path.join(root, 'scripts/mila-seed-alt.js'), 'utf8')
const arr = srcText.match(/const SEED_RECIPES = (\[[\s\S]*?\n\])\n/)
if (!arr) throw new Error('SEED_RECIPES nicht gefunden')
const OLD = new Function('return ' + arr[1])()

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

/** Feste, wiederholbare UUID aus einem Namen (damit SQL und JSON dieselben IDs haben). */
function uuid(name) {
  const h = createHash('sha1').update('mila:' + name).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function categorize(name) {
  const n = (name || '').toLowerCase()
  for (const { cat, keywords } of shop.rules) for (const kw of keywords) if (n.includes(kw)) return cat
  return 'sonstiges'
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/** „1/2“ → 0.5, „8-10“ → 8 (unsicher), „“ → null */
function parseAmount(a) {
  a = (a ?? '').toString().trim()
  if (!a) return { num: null }
  const frac = a.match(/^(\d+)\/(\d+)$/)
  if (frac) return { num: Number(frac[1]) / Number(frac[2]) }
  const range = a.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/)
  if (range) return { num: parseFloat(range[1].replace(',', '.')), unsure: `Menge „${a}“ → ${range[1]} genommen` }
  const n = parseFloat(a.replace(',', '.'))
  if (Number.isNaN(n)) return { num: null, unsure: `Menge „${a}“ nicht lesbar, leer gelassen` }
  return { num: n }
}

/** Thermomix-Angabe wie „5 min / 120°C / Linkslauf / Stufe 1“ */
const TM = /(\d+)\s*(min|sek)\s*\/\s*(?:(\d+)\s*°C|(varoma))?\s*\/?\s*(linkslauf)?\s*\/?\s*stufe\s*(\d+|löffel)/i

function parseStep(text) {
  const tm = text.match(TM)
  if (tm) {
    const n = Number(tm[1])
    const before = text.slice(0, tm.index).replace(/[\s,:→]+$/, '').trim()
    const after = text
      .slice(tm.index + tm[0].length)
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .trim()
    const oneWord = after && !/\s/.test(after)
    return {
      title: oneWord ? cap(after) : null,
      text: oneWord || !after ? before : `${before}. ${cap(after)}`,
      timer_sec: null,
      is_thermomix: true,
      tm_time_sec: tm[2].toLowerCase() === 'sek' ? n : n * 60,
      tm_temp: tm[3] ? tm[3] : tm[4] ? 'Varoma' : '',
      tm_speed: cap(tm[6]),
      tm_reverse: !!tm[5],
      unsure: oneWord || !after ? null : 'Thermomix-Schritt: Text nach der Einstellung war länger als ein Wort, kein Titel gesetzt',
    }
  }
  // Normaler Schritt: erste Zeitangabe wird der Timer
  const base = { title: null, text, timer_sec: null, is_thermomix: false, tm_time_sec: null, tm_temp: null, tm_speed: null, tm_reverse: false, unsure: null }
  const t = text.toLowerCase()
  const times = [...t.matchAll(/(\d+)\s*h\b(?:\s*(\d+)\s*min\b)?|(\d+)(?:\s*[–-]\s*(\d+))?\s*min\b/g)]
  if (!times.length) return base
  if (/mind\.|mindestens|besser \d|idealerweise|kühlschrank|vorabend|über nacht/.test(t)) {
    return { ...base, unsure: 'Marinier- oder Wartezeit, kein Timer gesetzt' }
  }
  const f = times[0]
  let sec
  let note = null
  if (f[1] !== undefined) sec = Number(f[1]) * 3600 + Number(f[2] ?? 0) * 60
  else {
    sec = Number(f[3]) * 60
    if (f[4]) note = `Bereich „${f[0].trim()}“: kleinerer Wert genommen`
  }
  if (times.length > 1) note = (note ? note + '; ' : '') + `mehrere Zeitangaben, erste („${f[0].trim()}“) genommen`
  return { ...base, timer_sec: sec, unsure: note }
}

const STOP = new Set(['oder', 'bio', 'frisch', 'gehackt', 'gerieben', 'extra', 'vergine', 'stück', 'nach', 'geschmack', 'zum', 'als', 'beilage', 'getrocknete', 'flocken', 'style', 'flach', 'dicke', 'schicht', 'dünn', 'klein', 'kleine', 'große', 'groß', 'wasser', 'salz', 'pfeffer'])

/** Wörter einer Zutat, mit denen wir sie im Schritttext suchen */
function ingredientKeys(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-zäöüß]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
}

function stepMentions(stepText, keys) {
  const t = stepText.toLowerCase()
  const words = t.split(/[^a-zäöüß]+/)
  return keys.some((w) => {
    if (t.includes(w.slice(0, Math.min(w.length, 6)))) return true
    return words.some((x) => x.length >= 4 && w.endsWith(x) && x !== w)
  })
}

// ---------------------------------------------------------------------------
// Umwandeln
// ---------------------------------------------------------------------------

const recipes = []
const report = []

for (const r of OLD) {
  const rid = uuid('recipe:' + r.id)
  const issues = []

  const notesParts = (r.notes ?? '').split(/\s*Valerie:\s*/)
  const notes = notesParts[0].trim() || null
  const valerie_note = notesParts.slice(1).join(' ').trim() || null
  if (notesParts.length > 2) issues.push('Mehrere „Valerie:“-Stellen in den Notizen, zusammengefasst')

  const ingredients = (r.ingredients ?? []).map((ing, i) => {
    const a = parseAmount(ing.amount)
    if (a.unsure) issues.push(`Zutat „${ing.name}“: ${a.unsure}`)
    return {
      id: uuid(`ing:${r.id}:${i}`),
      recipe_id: rid,
      position: i,
      name: ing.name.trim(),
      amount: a.num,
      unit: (ing.unit ?? '').trim(),
      pantry_basic: !!ing.pantry_basic,
      shop_category: categorize(ing.name),
    }
  })

  const keys = ingredients.map((ing) => ingredientKeys(ing.name))
  const linked = new Set()
  const steps = (r.steps ?? []).map((text, i) => {
    const p = parseStep(text)
    if (p.unsure) issues.push(`Schritt ${i + 1}: ${p.unsure}`)
    const ids = []
    ingredients.forEach((ing, k) => {
      if (keys[k].length && stepMentions(text, keys[k])) {
        ids.push(ing.id)
        linked.add(ing.id)
      }
    })
    const { unsure, ...rest } = p
    return { id: uuid(`step:${r.id}:${i}`), recipe_id: rid, position: i, ...rest, ingredient_ids: ids }
  })

  const unlinked = ingredients.filter((ing) => !linked.has(ing.id)).map((ing) => ing.name)
  if (unlinked.length) issues.push(`Keinem Schritt zugeordnet: ${unlinked.join(', ')}`)

  recipes.push({
    id: rid,
    name: r.name,
    category: r.category,
    time_min: r.time_min ?? null,
    portions: r.portions ?? 2,
    valerie_tauglich: !!r.valerie_tauglich,
    devices: r.device ?? [],
    notes,
    valerie_note,
    image_url: null,
    ingredients,
    steps,
  })
  if (issues.length) report.push({ name: r.name, issues })
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const num = (n) => (n === null || n === undefined ? 'null' : String(n))
const textArr = (a) => (a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`)
const uuidArr = (a) => (a.length ? `array[${a.map(q).join(', ')}]::uuid[]` : `'{}'::uuid[]`)

const sql = []
sql.push(`-- Mila · Schritt 2 · Rezepte aus der alten Mila-App (${recipes.length} Gerichte)
-- Erzeugt von scripts/mila-import.mjs, bitte nicht von Hand ändern.
-- Mehrfaches Einspielen ist unschädlich (on conflict do nothing).

do $$
declare
  h  uuid;
  mx uuid;
begin
  select id into h from public.households order by created_at limit 1;
  select id into mx from public.members where lower(email) = 'maxarmborst@gmail.com' limit 1;
`)
for (const r of recipes) {
  sql.push(`  -- ${r.name}`)
  sql.push(
    `  insert into public.mila_recipes (id, household_id, name, category, time_min, portions, valerie_tauglich, devices, notes, valerie_note, created_by) values\n` +
      `    (${q(r.id)}, h, ${q(r.name)}, ${q(r.category)}, ${num(r.time_min)}, ${num(r.portions)}, ${r.valerie_tauglich}, ${textArr(r.devices)}, ${q(r.notes)}, ${q(r.valerie_note)}, mx)\n` +
      `    on conflict (id) do nothing;`,
  )
  if (r.ingredients.length) {
    sql.push(
      `  insert into public.mila_ingredients (id, household_id, recipe_id, position, name, amount, unit, pantry_basic, shop_category) values\n` +
        r.ingredients.map((i) => `    (${q(i.id)}, h, ${q(i.recipe_id)}, ${i.position}, ${q(i.name)}, ${num(i.amount)}, ${q(i.unit)}, ${i.pantry_basic}, ${q(i.shop_category)})`).join(',\n') +
        `\n    on conflict (id) do nothing;`,
    )
  }
  if (r.steps.length) {
    sql.push(
      `  insert into public.mila_steps (id, household_id, recipe_id, position, title, text, timer_sec, is_thermomix, tm_time_sec, tm_temp, tm_speed, tm_reverse, ingredient_ids) values\n` +
        r.steps
          .map(
            (s) =>
              `    (${q(s.id)}, h, ${q(s.recipe_id)}, ${s.position}, ${q(s.title)}, ${q(s.text)}, ${num(s.timer_sec)}, ${s.is_thermomix}, ${num(s.tm_time_sec)}, ${q(s.tm_temp)}, ${q(s.tm_speed)}, ${s.tm_reverse}, ${uuidArr(s.ingredient_ids)})`,
          )
          .join(',\n') +
        `\n    on conflict (id) do nothing;`,
    )
  }
  sql.push('')
}
sql.push('end $$;\n')
writeFileSync(path.join(root, 'supabase/migrations/20261101100100_mila_rezepte.sql'), sql.join('\n'))

// ---------------------------------------------------------------------------
// JSON für den Demo-Modus
// ---------------------------------------------------------------------------

writeFileSync(path.join(root, 'src/mila/seed.json'), JSON.stringify(recipes, null, 1) + '\n')

// ---------------------------------------------------------------------------
// Bericht
// ---------------------------------------------------------------------------

const nTm = recipes.flatMap((r) => r.steps).filter((s) => s.is_thermomix).length
const nTimer = recipes.flatMap((r) => r.steps).filter((s) => s.timer_sec).length
const nSteps = recipes.flatMap((r) => r.steps).length
const nIng = recipes.flatMap((r) => r.ingredients).length
const md = [
  '# Rezept-Umzug · unsichere Stellen',
  '',
  `Erzeugt von \`scripts/mila-import.mjs\`. ${recipes.length} Gerichte, ${nIng} Zutaten, ${nSteps} Schritte, davon ${nTm} Thermomix-Schritte und ${nTimer} normale Schritte mit Timer.`,
  '',
  'Alles unten ist eingespielt, aber nach einer Faustregel entschieden. Was dir nicht passt, lässt sich später im Rezept-Formular ändern.',
  '',
]
for (const r of report) {
  md.push(`## ${r.name}`)
  for (const i of r.issues) md.push(`- ${i}`)
  md.push('')
}
writeFileSync(path.join(root, 'mila-briefing/UMZUG-unsicher.md'), md.join('\n'))

console.log(`${recipes.length} Gerichte, ${nIng} Zutaten, ${nSteps} Schritte (${nTm} Thermomix, ${nTimer} mit Timer), ${report.length} Gerichte mit Hinweisen`)
