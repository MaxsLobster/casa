// Casa · Edge Function „mila-tick“ (Wochenwahl)
// Läuft, wenn pg_cron (public.mila_tick) etwas Fälliges findet:
//  1. Ab Freitag: Woche für die nächste Woche anlegen (Anzahl wie letzte Woche, Frist Sonntag 20 Uhr)
//  2. Frist vorbei oder beide fertig gewischt: Kombo bauen (Joker → Treffer → halbe Treffer → offen)
// Die App macht dasselbe beim Öffnen; wer zuerst kommt, baut (Status wischen → kombo, nur einmal).
// Die Rechnung kommt gebündelt aus src/mila/wahl.ts (engine.js, `npm run build:mila-tick`).
import { createClient } from 'npm:@supabase/supabase-js@2'
// @ts-ignore: gebündeltes JavaScript ohne Typen
import * as E from './engine.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

/** Jetzt in Berlin als „YYYY-MM-DDTHH:MM“ */
function berlinStamp(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}
/** Berliner Ortszeit „YYYY-MM-DDTHH:MM“ → ISO in UTC */
function berlinToIso(stamp: string): string {
  const guess = new Date(stamp + ':00Z')
  const shown = new Date(berlinStamp(guess) + ':00Z')
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString()
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-key') !== CRON_SECRET) return json(401, { error: 'nicht erlaubt' })
  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  const now = berlinStamp(new Date())
  const log: string[] = []

  const { data: settingsRows, error } = await db.from('mila_settings').select('*')
  if (error) return json(500, { error: error.message })

  for (const s of settingsRows ?? []) {
    const hid = s.household_id as string
    try {
      const rhythm = { ...E.DEFAULT_RHYTHM, ...s, card_time: String(s.card_time).slice(0, 5), close_time: String(s.close_time).slice(0, 5), prep_time: String(s.prep_time).slice(0, 5) }
      // seitenweise lesen (Zutaten sind mehr als 1000)
      const sel = async (table: string, extra: Record<string, string> = {}) => {
        const out: Record<string, unknown>[] = []
        for (let from = 0; ; from += 1000) {
          let q = db.from(table).select('*').eq('household_id', hid)
          for (const [k, v] of Object.entries(extra)) q = q.eq(k, v)
          const { data, error } = await q.order('id').range(from, from + 999)
          if (error) throw new Error(table + ': ' + error.message)
          out.push(...(data ?? []))
          if (!data || data.length < 1000) break
        }
        return out
      }
      const plans = await sel('mila_week_plans')

      // 1. Neue Woche ab Freitag
      const wk = E.wahlWeek(now, rhythm)
      if (wk && !plans.some((p) => p.week === wk)) {
        const t = E.planTimes(wk, rhythm)
        const last = [...plans].sort((a, b) => String(b.week).localeCompare(String(a.week)))[0]
        const { error: e } = await db.from('mila_week_plans').upsert(
          { household_id: hid, week: wk, abend_anzahl: last?.abend_anzahl ?? 5, mittag_anzahl: last?.mittag_anzahl ?? 2, deadline: berlinToIso(t.deadline), status: 'wischen', einkauf_tag: t.einkauf, prep_tag: t.prep },
          { onConflict: 'household_id,week', ignoreDuplicates: true },
        )
        if (e) throw new Error('Woche: ' + e.message)
        log.push(`${hid}: Woche ${wk} angelegt`)
      }

      // 2. Kombo bauen
      for (const p of plans) {
        if (p.status !== 'wischen') continue
        const due = new Date(String(p.deadline)).getTime() <= Date.now() || !!p.beide_fertig_at
        if (!due) continue
        const { data: claimed } = await db.from('mila_week_plans').update({ status: 'kombo', kombo_at: new Date().toISOString() }).eq('id', p.id).eq('status', 'wischen').select('id')
        if (!claimed?.length) continue
        const [recipes, ingredients, rules, swipes] = await Promise.all([sel('mila_recipes'), sel('mila_ingredients'), sel('mila_haltbarkeit_regeln'), sel('mila_swipes', { plan_id: String(p.id) })])
        const byRecipe = new Map<string, unknown[]>()
        for (const i of ingredients) byRecipe.set(String(i.recipe_id), [...(byRecipe.get(String(i.recipe_id)) ?? []), i])
        const eingang = E.eingangFromSwipes(swipes.map((x) => ({ recipe_id: String(x.recipe_id), wahl: String(x.wahl) })))
        const rows = E.buildKombo({ plan: p, eingang, recipes, ingredientsOf: (id: string) => byRecipe.get(id) ?? [], rules, seed: p.id })
        const ids = new Map(rows.map((r: { key: string }) => [r.key, crypto.randomUUID()]))
        // deno-lint-ignore no-explicit-any
        const shape = (r: any) => {
          const { key, parent_key, ...rest } = r
          return { ...rest, id: ids.get(key), household_id: hid, plan_id: p.id, parent_id: parent_key ? (ids.get(parent_key) ?? null) : null }
        }
        // deno-lint-ignore no-explicit-any
        const parents = rows.filter((r: any) => !r.parent_key).map(shape)
        // deno-lint-ignore no-explicit-any
        const children = rows.filter((r: any) => r.parent_key).map(shape)
        if (parents.length) {
          const { error: e1 } = await db.from('mila_plan_items').insert(parents)
          if (e1) throw new Error('Kombo: ' + e1.message)
        }
        if (children.length) {
          const { error: e2 } = await db.from('mila_plan_items').insert(children)
          if (e2) throw new Error('Reste: ' + e2.message)
        }
        log.push(`${hid}: Kombo ${p.week} (${parents.length} Gerichte)`)
      }
    } catch (err) {
      log.push(`${hid}: Fehler ${(err as Error).message}`)
    }
  }
  return json(200, { ok: true, now, log })
})
