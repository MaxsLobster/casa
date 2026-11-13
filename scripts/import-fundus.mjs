// Mila · Fundus importieren: Gerichte, Hausmischungen und Fotos aus einer Fundus-JSON nach Supabase.
// Die Datei liegt AUSSERHALB des Repos und kommt nie hinein (siehe .gitignore). Aufruf:
//   SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-fundus.mjs ~/Downloads/mila-fundus.json [--ohne-fotos]
// Upsert über hf_id: ein zweiter Lauf bringt die Gerichte auf den Stand der Datei und verdoppelt nichts.
// Eigene Gerichte (ohne hf_id) fasst das Skript nicht an. Fotos werden verkleinert (macOS „sips“)
// und nur hochgeladen, wenn sie im Speicher noch fehlen.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const file = process.argv[2]
const withPhotos = !process.argv.includes('--ohne-fotos')
if (!file) throw new Error('Pfad zur Fundus-JSON fehlt')
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) throw new Error('SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt')
const db = createClient(URL_, KEY, { auth: { persistSession: false } })
const BUCKET = 'mila-fotos'

const data = JSON.parse(readFileSync(file, 'utf8'))
const report = { gerichte_neu: 0, gerichte_aktualisiert: 0, zutaten: 0, schritte: 0, tm_schritte: 0, hausmischungen: 0, fotos_hochgeladen: 0, fotos_vorhanden: 0, fotos_fehler: [], uebersprungen: [] }

const SHOP = { 'Obst & Gemüse': 'obst_gemuese', Kühlregal: 'kuehl', 'Fleisch & Fisch': 'fleisch_fisch', Vorrat: 'trocken', Sonstiges: 'sonstiges' }
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

const { data: hh } = await db.from('households').select('id').order('created_at').limit(1)
const hid = hh?.[0]?.id
if (!hid) throw new Error('Kein Haushalt gefunden')

// ---------- Fotos ----------
const work = mkdtempSync(join(tmpdir(), 'mila-fotos-'))
const existing = new Set()
async function listFolder(prefix) {
  const { data: rows } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 })
  for (const r of rows ?? []) existing.add(`${prefix}/${r.name}`)
}
async function photo(url, path, width) {
  if (!url || !withPhotos) return url ? path : null
  if (existing.has(path)) {
    report.fotos_vorhanden++
    return path
  }
  try {
    // Die Bild-Quelle antwortet unter Last mit 502: bis zu fünfmal mit Pause erneut versuchen
    // Der alte CloudFront-Pfad liefert nur noch 502; derselbe Pfad über den Bild-Dienst von HelloFresh geht
    const src = url.replace(/^https:\/\/d3hvwccx09j84u\.cloudfront\.net\/[^/]+\//, `https://img.hellofresh.com/w_${width},q_auto,c_limit/hellofresh_s3/`)
    let res
    for (let t = 0; t < 5; t++) {
      res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (res.ok || res.status < 500) break
      await new Promise((r) => setTimeout(r, 1500 * (t + 1)))
    }
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const raw = join(work, path.replace(/\//g, '_') + '.src')
    const out = join(work, path.replace(/\//g, '_'))
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()))
    execFileSync('sips', ['-Z', String(width), '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', raw, '--out', out], { stdio: 'ignore' })
    const up = await db.storage.from(BUCKET).upload(path, readFileSync(out), { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
    if (up.error) throw new Error(up.error.message)
    report.fotos_hochgeladen++
    return path
  } catch (err) {
    report.fotos_fehler.push(`${path}: ${err.message}`)
    return null
  }
}
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  }))
  return out
}

// ---------- Hausmischungen ----------
for (const m of data.hausmischungen ?? []) {
  must(
    await db.from('mila_hausmischungen').upsert(
      { household_id: hid, key: m.id, name: m.name, ersetzt: m.ersetzt ?? null, glas_rezept: m.glas_rezept ?? [], portion: m.portion ?? null, haltbar: m.haltbar ?? null, scharf: !!m.scharf, geschaetzt: m.geschaetzt !== false, hinweis: m.hinweis ?? null },
      { onConflict: 'household_id,key' },
    ),
    'Hausmischung ' + m.id,
  )
  report.hausmischungen++
}

// ---------- Gerichte ----------
const { data: known } = await db.from('mila_recipes').select('id, hf_id').eq('household_id', hid).not('hf_id', 'is', null)
const byHf = new Map((known ?? []).map((r) => [r.hf_id, r.id]))

for (const g of data.gerichte ?? []) {
  if (!g.hf_id || !g.titel) {
    report.uebersprungen.push(`Nr. ${g.nr ?? '?'}: hf_id oder Titel fehlt`)
    continue
  }
  const m = g.mila ?? {}
  const meals = m.mahlzeit ?? ['abend']
  const meal = meals.includes('mittag') && meals.includes('abend') ? 'beides' : meals.includes('mittag') ? 'mittag' : 'abend'
  if (withPhotos) await listFolder(g.hf_id)
  const mainPath = await photo(g.foto_url, `${g.hf_id}/gericht.jpg`, 900)
  const stepPaths = await pool(g.schritte ?? [], 2, (s) => photo(s.foto_url, `${g.hf_id}/schritt-${s.nr}.jpg`, 480))

  const row = {
    household_id: hid,
    hf_id: g.hf_id,
    name: g.titel.trim(),
    subtitle: g.untertitel ?? null,
    blurb: g.untertitel ?? null,
    source_url: g.hf_link ?? null,
    photo_path: mainPath,
    category: m.prep?.tauglich ? 'mealprep' : 'schnell',
    time_min: g.zeit_min ?? null,
    portions: g.portionen_basis ?? data.portionen_basis ?? 2,
    difficulty: g.schwierigkeit ?? null,
    meal,
    label: g.tags?.[0] ?? null,
    devices: m.thermomix_gericht ? ['thermomix'] : [],
    valerie_note: m.valerie_hinweis ?? null,
    valerie_tauglich: !!m.valerie_hinweis,
    cook_double: !!m.doppelt_mittag,
    prep_box: !!m.prep?.tauglich,
    tags: g.tags ?? [],
    cuisine: g.kueche ?? [],
    allergens: g.allergene ?? [],
    traces: g.spuren ?? [],
    utensils: g.utensilien ?? [],
    optional_items: m.weglassbar ?? [],
    nutrition: g.naehrwerte_pro_portion ?? null,
    prep_info: m.prep ?? null,
    device_tips: m.geraete ?? null,
    variants: g.varianten ?? null,
    kit: m.kit ?? null,
    anna: m.anna ?? null,
  }
  let rid = byHf.get(g.hf_id)
  if (rid) {
    must(await db.from('mila_recipes').update(row).eq('id', rid), 'Gericht ' + g.titel)
    must(await db.from('mila_ingredients').delete().eq('recipe_id', rid), 'Zutaten löschen')
    must(await db.from('mila_steps').delete().eq('recipe_id', rid), 'Schritte löschen')
    report.gerichte_aktualisiert++
  } else {
    rid = must(await db.from('mila_recipes').insert(row).select('id').single(), 'Gericht ' + g.titel).id
    byHf.set(g.hf_id, rid)
    report.gerichte_neu++
  }

  const ings = (g.zutaten ?? []).filter((z) => z.name?.trim()).map((z, i) => ({
    household_id: hid,
    recipe_id: rid,
    position: z.pos ?? i + 1,
    name: z.name.trim(),
    amount: typeof z.menge === 'number' ? z.menge : null,
    unit: z.einheit ?? '',
    pantry_basic: !!z.hast_du_da,
    shop_category: SHOP[z.ladengang] ?? 'sonstiges',
    hint: z.hinweis ?? null,
    hf_original: z.hf_original ?? null,
    blend_key: z.hausmischung_id ?? null,
    anna_swap: !!z.anna_ersatz,
  }))
  if (ings.length) must(await db.from('mila_ingredients').insert(ings), 'Zutaten ' + g.titel)
  report.zutaten += ings.length

  const steps = (g.schritte ?? []).map((s, i) => ({
    household_id: hid,
    recipe_id: rid,
    position: s.nr ?? i + 1,
    title: s.titel ?? null,
    text: s.text ?? '',
    timer_sec: s.timer_sec ?? null,
    is_thermomix: false,
    tm_time_sec: null,
    tm_temp: null,
    tm_speed: null,
    tm_reverse: false,
    variant: 'original',
    photo_path: stepPaths[i] ?? null,
    in_prep: !!s.im_prep,
  }))
  const tm = (m.tm_schritte ?? []).map((s, i) => ({
    household_id: hid,
    recipe_id: rid,
    position: i + 1,
    title: s.titel ?? null,
    text: s.text ?? '',
    is_thermomix: true,
    variant: 'thermomix',
    tm_time_sec: s.tm_zeit_sec ?? null,
    tm_temp: s.tm_temp ?? null,
    tm_speed: s.tm_stufe ?? null,
    tm_reverse: !!s.tm_linkslauf,
    timer_sec: null,
    photo_path: null,
    in_prep: false,
  }))
  if (steps.length + tm.length) must(await db.from('mila_steps').insert([...steps, ...tm]), 'Schritte ' + g.titel)
  report.schritte += steps.length
  report.tm_schritte += tm.length
  process.stdout.write('.')
}
rmSync(work, { recursive: true, force: true })
console.log('\n' + JSON.stringify(report, null, 2))
