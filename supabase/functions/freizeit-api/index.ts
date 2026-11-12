// Casa · Edge Function „freizeit-api“
// Schnittstelle für den Freizeit-Scout (externer Recherche-Bot). Genau drei Aktionen:
//   POST /radar     → Wochenend-Radar mit Tipps anlegen, Mitteilung an beide
//   POST /alarm     → einzelner Tipp mit Frist, Mitteilung an beide
//   GET  /feedback  → Tipps seit einem Datum mit Status und Notiz
// Schutz: Header x-freizeit-key (Supabase-Secret FREIZEIT_KEY). Die Funktion fasst nur die beiden
// Freizeit-Tabellen an und stellt Mitteilungen über enqueue_notification ein (Ruhezeiten gelten).
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FREIZEIT_KEY = Deno.env.get('FREIZEIT_KEY') ?? ''

const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

class Bad extends Error {}

/** Vergleich ohne Zeit-Leck */
function sameKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const validDate = (s: string) => DATE.test(s) && !Number.isNaN(new Date(s + 'T12:00:00Z').getTime())

function berlin(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

/** Berliner Mitternacht eines Tages als ISO */
function berlinMidnight(date: string): string {
  const guess = new Date(date + 'T00:00:00Z')
  const b = berlin(guess)
  const shown = new Date(`${b.date}T${b.time}:00Z`)
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString()
}

/** Zeitpunkt lesen: „YYYY-MM-DD“ (ganztägig) oder ISO mit Zeitzone */
function readTime(v: unknown, field: string): { iso: string; allDay: boolean; day: string } | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') throw new Bad(`${field}: Text erwartet`)
  if (DATE.test(v)) {
    if (!validDate(v)) throw new Bad(`${field}: kein gültiges Datum`)
    return { iso: berlinMidnight(v), allDay: true, day: v }
  }
  const d = new Date(v)
  if (Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(v)) throw new Bad(`${field}: ISO-Datum erwartet, z. B. 2026-11-14T15:00:00+01:00`)
  const b = berlin(d)
  return { iso: d.toISOString(), allDay: b.time === '00:00', day: b.date }
}

const text = (v: unknown, field: string, max = 600): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new Bad(`${field}: Text erwartet`)
  const t = v.trim()
  if (!t || t.toLowerCase() === 'null') return null
  return t.slice(0, max)
}

const TYPEN = ['haupt', 'planb', 'oma', 'vorschau']

// deno-lint-ignore no-explicit-any
function readTipp(raw: any, typ: string | null, hid: string, radarId: string | null) {
  if (!raw || typeof raw !== 'object') throw new Bad('Tipp: Objekt erwartet')
  const t = typ ?? raw.typ
  if (!TYPEN.includes(t) && t !== 'alarm') throw new Bad(`typ: ${TYPEN.join(' | ')} erwartet`)
  const titel = text(raw.titel, 'titel', 200)
  if (!titel) throw new Bad('titel fehlt')
  const start = readTime(raw.start, 'start')
  const ende = readTime(raw.ende, 'ende')
  const frist = text(raw.frist, 'frist', 10)
  if (frist && !validDate(frist)) throw new Bad('frist: YYYY-MM-DD erwartet')
  const link = text(raw.link, 'link', 1000)
  if (link && !/^https?:\/\//i.test(link)) throw new Bad('link: muss mit http:// oder https:// beginnen')
  let fahrzeit: number | null = null
  if (raw.fahrzeit_min !== null && raw.fahrzeit_min !== undefined && raw.fahrzeit_min !== '') {
    fahrzeit = Math.round(Number(raw.fahrzeit_min))
    if (!Number.isFinite(fahrzeit) || fahrzeit < 0 || fahrzeit > 1000) throw new Bad('fahrzeit_min: Zahl in Minuten erwartet')
  }
  const anm = text(raw.anmeldung, 'anmeldung', 20)?.toLowerCase() ?? 'unbekannt'
  return {
    household_id: hid,
    radar_id: radarId,
    typ: t as string,
    titel,
    start: start?.iso ?? null,
    ende: ende?.iso ?? null,
    ganztags: start ? start.allDay : false,
    start_tag: start?.day ?? null,
    ort: text(raw.ort, 'ort', 300),
    fahrzeit_min: fahrzeit,
    preis: text(raw.preis, 'preis', 300),
    anmeldung: ['ja', 'nein'].includes(anm) ? anm : 'unbekannt',
    frist,
    warum_valerie: text(raw.warum_valerie, 'warum_valerie'),
    fuer_euch: text(raw.fuer_euch, 'fuer_euch'),
    hinweis: text(raw.hinweis, 'hinweis', 300),
    link,
    grund: t === 'alarm' ? text(raw.grund, 'grund') : null,
  }
}

const deDate = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`

Deno.serve(async (req) => {
  const given = req.headers.get('x-freizeit-key') ?? ''
  if (!FREIZEIT_KEY || !sameKey(given, FREIZEIT_KEY)) return json(401, { error: 'nicht erlaubt' })

  const url = new URL(req.url)
  const action = url.pathname.replace(/\/+$/, '').split('/').pop()
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { data: hh, error: he } = await db.from('households').select('id').order('created_at').limit(1)
    if (he || !hh?.length) return json(500, { error: 'Haushalt nicht gefunden' })
    const hid = hh[0].id as string

    /** Mitteilung an beide (oder im Test nur an eine Person: Feld "push_nur": "Max"; "push_nur": "niemand" = keine) */
    const push = async (title: string, body: string, only: unknown) => {
      if (only === 'niemand') return 0
      const { data: members, error } = await db.from('members').select('id, display_name, role').eq('household_id', hid).eq('role', 'partner')
      if (error) throw new Error(error.message)
      const list = (members ?? []).filter((m) => typeof only !== 'string' || !only || m.display_name.toLowerCase() === only.toLowerCase())
      for (const m of list) {
        const { error: e } = await db.rpc('enqueue_notification', {
          p_household: hid, p_recipient: m.id, p_kind: 'freizeit', p_title: title, p_body: body, p_url: '#/freizeit', p_item_type: null, p_item_id: null,
        })
        if (e) throw new Error('Mitteilung: ' + e.message)
      }
      return list.length
    }

    /** Tipps einfügen; doppelte (gleicher Link bzw. Titel + gleicher Tag) werden übersprungen */
    const insertTipps = async (rows: ReturnType<typeof readTipp>[]) => {
      let neu = 0
      let doppelt = 0
      const ids: string[] = []
      for (const row of rows) {
        const { data, error } = await db.from('freizeit_tipps').insert(row).select('id').single()
        if (error) {
          if (error.code === '23505') {
            doppelt++
            continue
          }
          throw new Error(error.message)
        }
        neu++
        ids.push(data.id)
      }
      return { neu, doppelt, ids }
    }

    if (req.method === 'POST' && action === 'radar') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') throw new Bad('JSON erwartet')
      const we = body.wochenende
      if (typeof we !== 'string' || !validDate(we)) throw new Bad('wochenende: YYYY-MM-DD (Samstag) erwartet')
      if (new Date(we + 'T12:00:00Z').getUTCDay() !== 6) throw new Bad('wochenende: muss ein Samstag sein')
      if (!Array.isArray(body.tipps) || body.tipps.length === 0) throw new Bad('tipps: Liste mit mindestens einem Tipp erwartet')
      if (body.tipps.length > 20) throw new Bad('tipps: höchstens 20')
      const wetter = text(body.wetter, 'wetter', 300)

      // erst alles prüfen, dann schreiben
      // deno-lint-ignore no-explicit-any
      const rows = body.tipps.map((t: any, i: number) => {
        try {
          if (t?.typ === 'alarm') throw new Bad('typ alarm gehört an /alarm')
          return readTipp(t, null, hid, null)
        } catch (err) {
          throw new Bad(`Tipp ${i + 1}: ${(err as Error).message}`)
        }
      })
      const { data: radar, error: re } = await db
        .from('freizeit_radar')
        .upsert({ household_id: hid, wochenende: we, wetter }, { onConflict: 'household_id,wochenende' })
        .select('id')
        .single()
      if (re) throw new Error(re.message)
      for (const r of rows) r.radar_id = radar.id
      const res = await insertTipps(rows)
      let mitteilungen = 0
      if (res.neu > 0) {
        const sun = new Date(new Date(we + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
        mitteilungen = await push('Wochenend-Radar ist da 🗓', `${res.neu} ${res.neu === 1 ? 'Tipp' : 'Tipps'} für ${deDate(we)}/${deDate(sun)}`, body.push_nur)
      }
      return json(200, { ok: true, radar_id: radar.id, tipps_neu: res.neu, tipps_doppelt: res.doppelt, mitteilungen })
    }

    if (req.method === 'POST' && action === 'alarm') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') throw new Bad('JSON erwartet')
      const row = readTipp(body, 'alarm', hid, null)
      const res = await insertTipps([row])
      let mitteilungen = 0
      if (res.neu > 0) {
        mitteilungen = await push(`🔔 ${row.titel}${row.frist ? ` – Frist ${deDate(row.frist)}` : ''}`, row.grund ?? 'Neuer Hinweis vom Freizeit-Scout', body.push_nur)
      }
      return json(200, { ok: true, id: res.ids[0] ?? null, doppelt: res.doppelt > 0, mitteilungen })
    }

    if (req.method === 'GET' && action === 'feedback') {
      const seit = url.searchParams.get('seit') ?? ''
      if (!validDate(seit)) throw new Bad('seit: YYYY-MM-DD erwartet')
      const { data, error } = await db
        .from('freizeit_tipps')
        .select('titel, link, start, typ, status, notiz, feedback_am')
        .eq('household_id', hid)
        .gte('erstellt_am', berlinMidnight(seit))
        .order('erstellt_am', { ascending: false })
        .limit(1000)
      if (error) throw new Error(error.message)
      return json(200, { ok: true, seit, anzahl: data?.length ?? 0, tipps: data ?? [] })
    }

    return json(404, { error: 'unbekannte Aktion. Erlaubt: POST /radar, POST /alarm, GET /feedback?seit=YYYY-MM-DD' })
  } catch (err) {
    if (err instanceof Bad) return json(400, { error: err.message })
    return json(500, { error: (err as Error).message })
  }
})
