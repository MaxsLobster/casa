// Casa · Edge Function „mila-tick“
// Läuft, wenn pg_cron (public.mila_tick) etwas Fälliges findet:
//  1. Karte ab (Fr 18 Uhr): Wochenkarte anlegen → Trigger schickt „Die Wochenkarte ist da“
//  2. Wahl schließt (Sa 12 Uhr): aufdecken und verteilen
//  3. Niemand hat übernommen (Sa 14 Uhr): automatisch übernehmen → Woche, Einkaufszettel, Vortag-Aufgaben;
//     der Trigger schickt „6 Mahlzeiten stehen · Einkaufszettel ist fertig“
// Die Rechnung kommt gebündelt aus src/mila/engine.ts (engine.js, `npm run build:mila-tick`).
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

const past = (iso: string) => new Date(iso).getTime() <= Date.now()

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
      const rhythm = {
        ...E.DEFAULT_RHYTHM,
        ...s,
        card_time: String(s.card_time).slice(0, 5),
        close_time: String(s.close_time).slice(0, 5),
        adopt_time: String(s.adopt_time).slice(0, 5),
        prep_time: String(s.prep_time).slice(0, 5),
      }
      const sel = async (table: string) => {
        const { data, error } = await db.from(table).select('*').eq('household_id', hid)
        if (error) throw new Error(table + ': ' + error.message)
        return data ?? []
      }
      const [recipes, ingredients, prepSteps, weekDays, menus, votes, members, events, fairs, normalWeek, overrides] = await Promise.all([
        sel('mila_recipes'), sel('mila_ingredients'), sel('mila_prep_steps'), sel('mila_week_days'), sel('mila_menus'), sel('mila_votes'),
        sel('members'), sel('events'), sel('fairs'), sel('normal_week'), sel('week_overrides'),
      ])
      const ctx = { members, events: [...events, ...E.fairEvents(fairs)], normalWeek, overrides }

      // 1. Karte für die nächste Woche
      const wk = E.cardWeek(now, rhythm)
      if (wk && !menus.some((m: { week: string }) => m.week === wk) && recipes.length) {
        const card = E.generateCard({ week: wk, recipes, weekDays, votes, rhythm })
        const t = E.menuTimes(wk, rhythm)
        const { error: e } = await db.from('mila_menus').upsert(
          { household_id: hid, week: wk, ...card, opens_at: berlinToIso(t.opens), closes_at: berlinToIso(t.closes), adopt_at: berlinToIso(t.adopt), created_by: null },
          { onConflict: 'household_id,week', ignoreDuplicates: true },
        )
        if (e) throw new Error('Karte: ' + e.message)
        log.push(`${hid}: Karte ${wk}`)
      }

      for (const m0 of menus) {
        let m = m0
        if (m.adopted_at || new Date(m.week).getTime() < Date.now() - 8 * 86400000) continue
        // 2. Frist vorbei: aufdecken
        if (!m.revealed_at && past(m.closes_at)) {
          const { data } = await db.from('mila_menus').update({ revealed_at: new Date().toISOString() }).eq('id', m.id).is('revealed_at', null).select('*')
          if (data?.[0]) m = data[0]
          log.push(`${hid}: aufgedeckt ${m.week}`)
        }
        // Verteilung rechnen
        if (m.revealed_at && !m.plan) {
          const plan = E.computePlan(m, votes, recipes, rhythm, ctx)
          const { data } = await db.from('mila_menus').update({ plan }).eq('id', m.id).is('plan', null).select('*')
          m = data?.[0] ?? { ...m, plan }
        }
        // 3. Niemand hat übernommen: automatisch
        if (m.plan && !m.adopted_at && past(m.adopt_at)) {
          const { data: claimed } = await db.from('mila_menus').update({ adopted_at: new Date().toISOString(), adopted_by: null }).eq('id', m.id).is('adopted_at', null).select('id')
          if (!claimed?.length) continue
          const w = E.adoptWrites(m, m.plan, recipes, ingredients, prepSteps, rhythm, ctx)
          const dates: string[] = E.workDays(m.week)
          await db.from('mila_week_days').delete().eq('household_id', hid).in('date', dates)
          if (w.weekDays.length) {
            const { error: e1 } = await db.from('mila_week_days').insert(w.weekDays.map((d: object) => ({ household_id: hid, ...d, free_text: null, added_to_list: true, created_by: null, updated_by: null })))
            if (e1) throw new Error('Woche: ' + e1.message)
          }
          await db.from('mila_shopping_items').delete().eq('household_id', hid).eq('source_week', E.weekKey(m.week)).eq('checked', false)
          if (w.items.length) {
            const { error: e2 } = await db.from('mila_shopping_items').insert(w.items.map((r: object) => ({ household_id: hid, ...r, added_by: null })))
            if (e2) throw new Error('Einkauf: ' + e2.message)
          }
          for (const t of w.tasks) {
            // Ersteller = Besitzer bzw. leer: keine Mitteilung
            await db.from('tasks').insert({ household_id: hid, title: t.title, owner_member_id: t.owner_member_id, due_date: t.due_date, status: 'offen', area: 'casa', created_by: t.owner_member_id, updated_by: t.owner_member_id })
          }
          log.push(`${hid}: automatisch übernommen ${m.week}`)
        }
      }
    } catch (err) {
      log.push(`${hid}: Fehler ${(err as Error).message}`)
    }
  }
  return json(200, { ok: true, now, log })
})
