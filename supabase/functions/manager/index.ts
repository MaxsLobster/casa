// Casa · Edge Function „manager“ – der Casa-Manager im Chat (einziger Weg zur Claude API).
//
// Ablauf:
//  action "chat":  Nachricht + Verlauf → Claude mit Werkzeugen. Lese-Werkzeuge laufen sofort (mit dem Login des Fragenden,
//                  RLS gilt). Schreib-Werkzeuge werden NICHT ausgeführt, sondern als Vorschlag gesammelt und zurückgegeben.
//  action "apply": die bestätigten Vorschläge ausführen; jede Änderung kommt mit vorher/nachher in manager_log.
//  action "undo":  die letzte Änderungsrunde zurücknehmen (30 Minuten lang).
//
// Zugang: nur eingeloggte Mitglieder (JWT wird hier geprüft). Kosten-Bremse: max_tokens begrenzt,
// höchstens 200 Claude-Aufrufe pro Tag und Haushalt (manager_take_call). MWF und Max' privates Add-on sind tabu.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
// @ts-ignore: gebündeltes JavaScript ohne Typen
import * as S from './shared.js'

/** Modell als Konstante – später leicht auf z. B. 'claude-opus-5-5' umstellbar */
const MODEL = 'claude-sonnet-5-5'
const MAX_TOKENS = 4000
const MAX_STEPS = 8
const DAILY_LIMIT = 200
const UNDO_MINUTES = 30

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })

const SYSTEM = `Du bist der Casa-Manager von Max und Anna – ihr ruhiger, verlässlicher Helfer für Haushalt, Woche, Essen und Freizeit. Du sprichst Deutsch, duzt, freundlich und knapp. Valerie ist ihre Tochter; wer sie bringt und holt, steht in der Normalwoche.

So arbeitest du:
- Erst mit den Lese-Werkzeugen nachsehen, dann handeln. Nichts erfinden: Was du nicht findest, sagst du.
- Änderungen schlägst du immer über die Schreib-Werkzeuge vor und fasst sie in einem Satz zusammen. Ausgeführt wird erst nach Okay.
- Bei Unklarheit (wer? wann?) eine kurze Rückfrage statt raten.
- Wenn eine Änderung die andere Person betrifft, sag das ausdrücklich („Anna bekommt dafür eine Mitteilung“).
- Halte Casa schlank: lieber zusammenfassen, archivieren und kurze Titel als neue lange Einträge.
- Kurze Antworten, am Handy lesbar, keine Tabellen.
- Den MWF-Bereich und Max' privates Add-on fasst du nicht an.

Hinweise zu Casa:
- Datumsangaben immer als YYYY-MM-DD in Werkzeugen. Personen heißen "max", "anna" oder "offen".
- Im Text an Max und Anna Datum so schreiben: „Di 24.11.“ (nie YYYY-MM-DD). Reiner Text ohne Markdown: keine Sternchen, keine Überschriften; Aufzählungen mit „– “.
- Wer eine Mitteilung bekommt, steht im Ergebnis des Vorschlags („Betrifft …“). Sag nur das, nichts anderes.
- Normalwoche-Felder (slot): valerie_bringen, valerie_holen, valerie_tag, anna_arbeit, nachmittag, abend_essen, abend_bett, wochenende. Eine Abweichung gilt nur für ein Datum. "wert": null heißt „offen – wer übernimmt?“.
- Ist jemand einen Tag weg (z. B. „Ich bin Dienstag in München“), lege einen Termin mit art "eltern_weg" für diese Person an; dann werden ihre Aufgaben an dem Tag offen. Frag nach, wer Valerie bringt bzw. holt, und schlage die Abweichung erst nach der Antwort vor.
- Mila: Steht die Woche als Kombo (ohne feste Tage) im Plan, nutze mila_kombo statt einzelner Gerichte. „Nicht eingekauft“ heißt meist: Kombo auf nächste Woche schieben.
- Gelöscht wird nichts endgültig: Aufgaben werden erledigt oder archiviert. Gerichte aus dem Essensplan dürfen entfernt werden.
- „Aufräumen“: lies Überfälliges, Doppeltes, Erledigtes und Uraltes und schlage die Runde gleich mit den Schreib-Werkzeugen vor (eine Karte zum Okay), nicht nur als Text. Aufgaben der anderen Person nur verschieben oder archivieren, wenn es eindeutig ist (erledigt?, verschieben, zusammenführen = eine behalten und die andere archivieren, archivieren). Nenne die Runde in einem Satz, z. B. „4 erledigt, 3 auf nächste Woche, 2 doppelt zusammenführen, 5 ins Archiv“.`

// ---------------------------------------------------------------------------
// Datum (Europe/Berlin)
// ---------------------------------------------------------------------------
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
const fromISO = (d: string) => new Date(d + 'T12:00:00Z')
const addDays = (d: string, n: number) => new Date(fromISO(d).getTime() + n * 86400000).toISOString().slice(0, 10)
const weekday = (d: string) => ((fromISO(d).getUTCDay() + 6) % 7) + 1 // 1 = Mo
const monday = (d: string) => addDays(d, 1 - weekday(d))
const nice = (d: string) => `${WD[fromISO(d).getUTCDay()]} ${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

// ---------------------------------------------------------------------------
// Werkzeuge
// ---------------------------------------------------------------------------
const P = (props: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties: props, required })
const str = (description: string) => ({ type: 'string', description })
const person = { type: 'string', enum: ['max', 'anna', 'offen'], description: 'Wer: max, anna oder offen' }
const slot = { type: 'string', enum: ['valerie_bringen', 'valerie_holen', 'valerie_tag', 'anna_arbeit', 'nachmittag', 'abend_essen', 'abend_bett', 'wochenende'] }

const READ_TOOLS: Anthropic.Tool[] = [
  { name: 'tage_lesen', description: 'Termine, Abweichungen von der Normalwoche, fällige Aufgaben und Essen für einen Zeitraum (höchstens 21 Tage). Für „heute“ von = bis = heute.', input_schema: P({ von: str('YYYY-MM-DD'), bis: str('YYYY-MM-DD') }, ['von', 'bis']) as never },
  { name: 'normalwoche_lesen', description: 'Die Normalwoche: wer an welchem Wochentag Valerie bringt und holt, kocht, ins Bett bringt usw.', input_schema: P({}) as never },
  { name: 'aufgaben_suchen', description: 'Aufgaben suchen (ohne MWF). Ohne Filter: alle offenen. Mit nur_ueberfaellig: offene mit Datum vor heute.', input_schema: P({ text: str('Suchtext im Titel oder in der Notiz'), person, status: { type: 'string', enum: ['offen', 'zugesagt', 'geparkt', 'erledigt', 'alle'] }, nur_ueberfaellig: { type: 'boolean' }, mit_archiv: { type: 'boolean' } }) as never },
  { name: 'mila_plan_lesen', description: 'Essensplan: eingetragene Gerichte pro Tag in einem Zeitraum, dazu die übernommene Kombo der Woche (ohne feste Tage).', input_schema: P({ von: str('YYYY-MM-DD'), bis: str('YYYY-MM-DD') }, ['von', 'bis']) as never },
  { name: 'einkaufsliste_lesen', description: 'Der Einkaufszettel: offene und abgehakte Zeilen.', input_schema: P({}) as never },
  { name: 'fundus_lesen', description: 'Gerichte im Fundus mit Filtern. Gibt id, Name, Mahlzeit, Zeit, Tags zurück.', input_schema: P({ suche: str('Teil des Namens'), mahlzeit: { type: 'string', enum: ['mittag', 'abend'] }, max_minuten: { type: 'integer' }, nur_prep: { type: 'boolean' } }) as never },
  { name: 'freizeit_lesen', description: 'Freizeit-Tipps (aktuelle und kommende) mit Status.', input_schema: P({}) as never },
  { name: 'anker_lesen', description: 'Anker (Themen, um die sich Max und Anna kümmern): Titel, Phase, nächster Schritt mit Person und Datum.', input_schema: P({}) as never },
  { name: 'verlauf_suchen', description: 'Im Verlauf suchen: Aufgaben (auch erledigt/archiviert), Termine, Anker und frühere Änderungen des Managers. Für Fragen wie „wann hatten wir das mit der Versicherung?“.', input_schema: P({ text: str('Suchtext') }, ['text']) as never },
]

const WRITE_TOOLS: Anthropic.Tool[] = [
  { name: 'aufgabe_anlegen', description: 'VORSCHLAG: neue Aufgabe. Wird erst nach Okay angelegt.', input_schema: P({ titel: str('kurzer Titel'), person, datum: str('fällig am, YYYY-MM-DD'), notiz: str('optional') }, ['titel', 'person', 'datum']) as never },
  { name: 'aufgabe_aendern', description: 'VORSCHLAG: Aufgabe ändern, verschieben, zuweisen, erledigen oder archivieren. Nur angeben, was sich ändert.', input_schema: P({ id: str('Aufgaben-id'), titel: { type: 'string' }, person, datum: str('neues Datum YYYY-MM-DD'), notiz: { type: 'string' }, status: { type: 'string', enum: ['offen', 'zugesagt', 'geparkt', 'erledigt'] }, archivieren: { type: 'boolean' } }, ['id']) as never },
  { name: 'termin_anlegen', description: 'VORSCHLAG: Termin oder Wochen-Eintrag. art: termin (normal), eltern_weg (Person ist weg, ihre Aufgaben werden offen), kita_zu, valerie_weg.', input_schema: P({ titel: { type: 'string' }, datum: str('YYYY-MM-DD'), bis_datum: str('letzter Tag bei mehrtägig, optional'), start: str('HH:MM, optional'), ende: str('HH:MM, optional'), person, art: { type: 'string', enum: ['termin', 'eltern_weg', 'kita_zu', 'valerie_weg'] }, notiz: { type: 'string' } }, ['titel', 'datum']) as never },
  { name: 'termin_aendern', description: 'VORSCHLAG: Termin ändern oder verschieben. Nur angeben, was sich ändert.', input_schema: P({ id: { type: 'string' }, titel: { type: 'string' }, datum: { type: 'string' }, bis_datum: { type: 'string' }, start: { type: 'string' }, ende: { type: 'string' }, person, notiz: { type: 'string' } }, ['id']) as never },
  { name: 'woche_abweichung', description: 'VORSCHLAG: Abweichung von der Normalwoche für ein Datum (z. B. „ich kann nicht“ = wert null, oder wer stattdessen Valerie holt).', input_schema: P({ datum: str('YYYY-MM-DD'), slot, wert: { type: ['string', 'null'], description: 'Name (Max, Anna, Oma …) oder null = offen' }, uhrzeit: str('HH:MM, optional'), notiz: { type: 'string' } }, ['datum', 'slot', 'wert']) as never },
  { name: 'mila_gericht_setzen', description: 'VORSCHLAG: ein Gericht aus dem Fundus für einen Tag eintragen.', input_schema: P({ datum: str('YYYY-MM-DD'), mahlzeit: { type: 'string', enum: ['mittag', 'abend'] }, rezept_id: { type: 'string' }, portionen: { type: 'integer' } }, ['datum', 'mahlzeit', 'rezept_id']) as never },
  { name: 'mila_gerichte_entfernen', description: 'VORSCHLAG: eingetragene Gerichte aus einem Zeitraum entfernen.', input_schema: P({ von: { type: 'string' }, bis: { type: 'string' }, mahlzeit: { type: 'string', enum: ['mittag', 'abend', 'beide'] } }, ['von', 'bis']) as never },
  { name: 'mila_gerichte_verschieben', description: 'VORSCHLAG: eingetragene Gerichte eines Zeitraums um n Tage verschieben (positiv = später).', input_schema: P({ von: { type: 'string' }, bis: { type: 'string' }, tage: { type: 'integer' } }, ['von', 'bis', 'tage']) as never },
  { name: 'mila_kombo', description: 'VORSCHLAG: die übernommene Kombo einer Woche (Gerichte ohne feste Tage) als Ganzes auf die nächste Woche schieben (aktion naechste_woche, z. B. wenn nicht eingekauft wurde) oder verwerfen (aktion verwerfen: Nicht-Gekochtes raus). Der Einkaufszettel wird dabei automatisch angepasst.', input_schema: P({ aktion: { type: 'string', enum: ['naechste_woche', 'verwerfen'] }, woche: str('irgendein Datum der Woche, YYYY-MM-DD') }, ['aktion', 'woche']) as never },
  { name: 'einkaufsliste', description: 'VORSCHLAG: Einkaufszettel einer Woche neu aus dem Essensplan erstellen (aktion neu) oder die offenen Zeilen aus dem Plan leeren (aktion leeren). Abgehakte und selbst eingetragene Zeilen bleiben.', input_schema: P({ aktion: { type: 'string', enum: ['neu', 'leeren'] }, woche: str('irgendein Datum der Woche, YYYY-MM-DD') }, ['aktion', 'woche']) as never },
  { name: 'freizeit_uebernehmen', description: 'VORSCHLAG: Freizeit-Tipp als „Machen wir“ markieren und als Termin in die Woche übernehmen.', input_schema: P({ tipp_id: { type: 'string' } }, ['tipp_id']) as never },
  { name: 'anker_schritt', description: 'VORSCHLAG: nächsten Schritt eines Ankers setzen oder aktualisieren.', input_schema: P({ anker_id: { type: 'string' }, titel: str('der nächste Schritt, kurz'), person, datum: str('bis wann, YYYY-MM-DD') }, ['anker_id', 'titel', 'person', 'datum']) as never },
]
const WRITE_NAMES = new Set(WRITE_TOOLS.map((t) => t.name))

// ---------------------------------------------------------------------------
// Kontext pro Anfrage
// ---------------------------------------------------------------------------
interface Member { id: string; display_name: string; role: string; household_id: string }
interface Ctx { db: SupabaseClient; me: Member; members: Member[]; hid: string; today: string }
interface Proposal { id: string; tool: string; input: Record<string, unknown>; summary: string; betrifft: string[] }

const nameOf = (c: Ctx, id: string | null | undefined) => (id ? (c.members.find((m) => m.id === id)?.display_name ?? '?') : 'offen')
function memberFor(c: Ctx, p: unknown): string | null {
  if (p === 'offen' || p === null || p === undefined) return null
  const m = c.members.find((x) => x.display_name.toLowerCase() === String(p).toLowerCase())
  if (!m) throw new Error(`Person „${p}“ gibt es nicht (max, anna oder offen)`)
  return m.id
}
const must = <T>(res: { data: T; error: { message: string } | null }, what: string): T => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}
const date = (v: unknown, what: string) => {
  if (typeof v !== 'string' || !DATE.test(v)) throw new Error(`${what}: Datum als YYYY-MM-DD`)
  return v
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------
async function runRead(c: Ctx, name: string, input: Record<string, unknown>): Promise<unknown> {
  const { db, hid, today } = c
  switch (name) {
    case 'tage_lesen': {
      const von = date(input.von, 'von')
      let bis = date(input.bis, 'bis')
      if (bis < von) bis = von
      if (bis > addDays(von, 20)) bis = addDays(von, 20)
      const [ev, ov, nw, tk, wd] = await Promise.all([
        db.from('events').select('id,title,date,end_date,start_time,end_time,member_id,effect,repeat,note').eq('household_id', hid).lte('date', bis),
        db.from('week_overrides').select('date,slot,value,at,note').eq('household_id', hid).gte('date', von).lte('date', bis),
        db.from('normal_week').select('weekday,slot,value,at,is_open').eq('household_id', hid),
        db.from('tasks').select('id,title,owner_member_id,due_date,status').eq('household_id', hid).eq('area', 'casa').is('archived_at', null).neq('status', 'erledigt').gte('due_date', von).lte('due_date', bis),
        db.from('mila_week_days').select('date,meal,recipe_id,is_leftover,servings').eq('household_id', hid).gte('date', von).lte('date', bis),
      ])
      const events = (must(ev, 'Termine') ?? []).filter((e: any) => (e.end_date ?? e.date) >= von || e.repeat)
      const rids = [...new Set((must(wd, 'Essen') ?? []).map((w: any) => w.recipe_id).filter(Boolean))]
      const recipes = rids.length ? must(await db.from('mila_recipes').select('id,name').in('id', rids), 'Gerichte') : []
      const rname = (id: string) => (recipes as any[]).find((r) => r.id === id)?.name ?? '?'
      const days = []
      for (let d = von; d <= bis; d = addDays(d, 1)) {
        const wdn = weekday(d)
        const normal: Record<string, string> = {}
        for (const n of must(nw, 'Normalwoche') ?? []) if ((n as any).weekday === wdn) normal[(n as any).slot] = (n as any).is_open ? 'offen' : [(n as any).value, (n as any).at?.slice(0, 5)].filter(Boolean).join(' ')
        for (const o of (must(ov, 'Abweichungen') ?? []).filter((o: any) => o.date === d)) normal[(o as any).slot] = `${(o as any).value ?? 'offen'}${(o as any).at ? ' ' + (o as any).at.slice(0, 5) : ''} (Abweichung)`
        days.push({
          datum: d,
          tag: nice(d),
          woche: normal,
          termine: events.filter((e: any) => e.date <= d && (e.end_date ?? e.date) >= d).map((e: any) => ({ id: e.id, titel: e.title, zeit: e.start_time?.slice(0, 5) ?? null, wer: nameOf(c, e.member_id), art: e.effect })),
          aufgaben: (must(tk, 'Aufgaben') ?? []).filter((t: any) => t.due_date === d).map((t: any) => ({ id: t.id, titel: t.title, wer: nameOf(c, t.owner_member_id), status: t.status })),
          essen: (must(wd, 'Essen') ?? []).filter((w: any) => w.date === d).map((w: any) => `${w.meal}: ${w.is_leftover ? 'Reste ' : ''}${rname(w.recipe_id)}`),
        })
      }
      return { tage: days, wiederholende_termine: events.filter((e: any) => e.repeat).map((e: any) => ({ titel: e.title, ab: e.date, wiederholung: e.repeat })) }
    }
    case 'normalwoche_lesen': {
      const rows = must(await db.from('normal_week').select('weekday,slot,value,at,is_open,note').eq('household_id', hid), 'Normalwoche') ?? []
      const out: Record<string, Record<string, string>> = {}
      for (const r of rows as any[]) {
        const k = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][r.weekday - 1]
        out[k] = { ...(out[k] ?? {}), [r.slot]: r.is_open ? 'offen' : [r.value, r.at?.slice(0, 5)].filter(Boolean).join(' ') }
      }
      return out
    }
    case 'aufgaben_suchen': {
      let q = db.from('tasks').select('id,title,owner_member_id,due_date,status,note,anchor_id,archived_at,done_at').eq('household_id', hid).eq('area', 'casa').order('due_date').limit(60)
      if (!input.mit_archiv) q = q.is('archived_at', null)
      const st = input.status as string | undefined
      if (st && st !== 'alle') q = q.eq('status', st)
      else if (!st) q = q.neq('status', 'erledigt')
      if (input.nur_ueberfaellig) q = q.lt('due_date', today).neq('status', 'erledigt')
      if (input.person) {
        const id = memberFor(c, input.person)
        q = id ? q.eq('owner_member_id', id) : q.is('owner_member_id', null)
      }
      if (typeof input.text === 'string' && input.text.trim()) q = q.or(`title.ilike.%${input.text.trim().replace(/[%,()]/g, ' ')}%,note.ilike.%${input.text.trim().replace(/[%,()]/g, ' ')}%`)
      const rows = must(await q, 'Aufgaben') ?? []
      return (rows as any[]).map((t) => ({ id: t.id, titel: t.title, wer: nameOf(c, t.owner_member_id), datum: t.due_date, status: t.status, notiz: t.note, archiviert: !!t.archived_at, anker: !!t.anchor_id }))
    }
    case 'mila_plan_lesen': {
      const von = date(input.von, 'von')
      const bis = date(input.bis, 'bis')
      const wd = must(await db.from('mila_week_days').select('id,date,meal,recipe_id,is_leftover,servings').eq('household_id', hid).gte('date', von).lte('date', bis).order('date'), 'Essen') ?? []
      const plan = (must(await db.from('mila_week_plans').select('id,week,status,adopted_at').eq('household_id', hid).eq('week', monday(von)), 'Kombo') ?? [])[0] as any
      const items = plan?.adopted_at && plan.status === 'aktiv' ? must(await db.from('mila_plan_items').select('recipe_id,slot,status,gruppe,frist_bis').eq('plan_id', plan.id).in('status', ['offen', 'gekocht']), 'Kombo') ?? [] : []
      const rids = [...new Set([...wd, ...items].map((w: any) => w.recipe_id))]
      const recipes = rids.length ? must(await db.from('mila_recipes').select('id,name').in('id', rids), 'Gerichte') ?? [] : []
      const rn = (id: string) => (recipes as any[]).find((r) => r.id === id)?.name ?? '?'
      return {
        tage: (wd as any[]).map((w) => ({ datum: w.date, tag: nice(w.date), mahlzeit: w.meal, gericht: rn(w.recipe_id), rezept_id: w.recipe_id, reste: w.is_leftover, portionen: w.servings })),
        kombo: (items as any[]).map((i) => ({ gericht: rn(i.recipe_id), slot: i.slot, status: i.status, haelt_bis: i.frist_bis })),
      }
    }
    case 'einkaufsliste_lesen': {
      const rows = must(await db.from('mila_shopping_items').select('name,amount,category,checked,source_label,source_week,is_stock').eq('household_id', hid).limit(300), 'Einkauf') ?? []
      const wks = new Set([S.weekKey(monday(today)), S.weekKey(addDays(monday(today), 7))])
      const cur = (rows as any[]).filter((r) => !r.source_week || wks.has(r.source_week))
      return { offen: cur.filter((r) => !r.checked && !r.is_stock).map((r) => `${r.name} ${r.amount}`.trim() + (r.source_label ? ` (${r.source_label})` : '')), abgehakt: cur.filter((r) => r.checked).length, vorrat: cur.filter((r) => r.is_stock && !r.checked).length }
    }
    case 'fundus_lesen': {
      let q = db.from('mila_recipes').select('id,name,meal,time_min,tags,prep_box,cook_double').eq('household_id', hid).order('name').limit(30)
      if (typeof input.suche === 'string' && input.suche.trim()) q = q.ilike('name', `%${input.suche.trim()}%`)
      if (input.mahlzeit) q = q.in('meal', [input.mahlzeit as string, 'beides'])
      if (typeof input.max_minuten === 'number') q = q.lte('time_min', input.max_minuten)
      if (input.nur_prep) q = q.eq('prep_box', true)
      return (must(await q, 'Fundus') ?? []).map((r: any) => ({ id: r.id, name: r.name, mahlzeit: r.meal, minuten: r.time_min, tags: (r.tags ?? []).slice(0, 3), prep: r.prep_box, doppelt: r.cook_double }))
    }
    case 'freizeit_lesen': {
      const rows = must(await db.from('freizeit_tipps').select('id,typ,titel,start_tag,start,ende,ort,status,frist').eq('household_id', hid).order('erstellt_am', { ascending: false }).limit(40), 'Freizeit') ?? []
      return (rows as any[]).filter((t) => !t.start_tag || (t.ende ?? t.start_tag) >= today).map((t) => ({ id: t.id, typ: t.typ, titel: t.titel, tag: t.start_tag, ort: t.ort, status: t.status, frist: t.frist }))
    }
    case 'anker_lesen': {
      const [an, st] = await Promise.all([
        db.from('anchors').select('id,title,phase,visibility,created_by,moved_at').eq('household_id', hid).eq('area', 'casa').is('archived_at', null),
        db.from('tasks').select('id,title,owner_member_id,due_date,anchor_id,status').eq('household_id', hid).eq('is_step', true).neq('status', 'erledigt'),
      ])
      return (must(an, 'Anker') ?? [])
        .filter((a: any) => a.visibility === 'shared' || a.created_by === c.me.id)
        .map((a: any) => {
          const s = (must(st, 'Schritte') ?? []).find((t: any) => t.anchor_id === a.id) as any
          return { id: a.id, titel: a.title, phase: a.phase, naechster_schritt: s ? { titel: s.title, wer: nameOf(c, s.owner_member_id), bis: s.due_date } : null }
        })
    }
    case 'verlauf_suchen': {
      const t = String(input.text ?? '').trim().replace(/[%,()]/g, ' ')
      if (!t) return []
      const [tk, ev, an, lg] = await Promise.all([
        db.from('tasks').select('title,due_date,status,done_at,owner_member_id').eq('household_id', hid).eq('area', 'casa').or(`title.ilike.%${t}%,note.ilike.%${t}%`).order('due_date', { ascending: false }).limit(15),
        db.from('events').select('title,date').eq('household_id', hid).ilike('title', `%${t}%`).order('date', { ascending: false }).limit(10),
        db.from('anchors').select('title,phase,moved_at,visibility,created_by').eq('household_id', hid).eq('area', 'casa').or(`title.ilike.%${t}%,notes.ilike.%${t}%`).limit(5),
        db.from('manager_log').select('summary,created_at').eq('household_id', hid).ilike('summary', `%${t}%`).order('created_at', { ascending: false }).limit(10),
      ])
      return {
        aufgaben: (must(tk, 'Aufgaben') ?? []).map((x: any) => ({ titel: x.title, datum: x.due_date, status: x.status, erledigt_am: x.done_at?.slice(0, 10) ?? null, wer: nameOf(c, x.owner_member_id) })),
        termine: (must(ev, 'Termine') ?? []).map((x: any) => ({ titel: x.title, datum: x.date })),
        anker: (must(an, 'Anker') ?? []).filter((a: any) => a.visibility === 'shared' || a.created_by === c.me.id).map((a: any) => ({ titel: a.title, phase: a.phase })),
        manager: (must(lg, 'Verlauf') ?? []).map((x: any) => ({ was: x.summary, am: x.created_at.slice(0, 10) })),
      }
    }
  }
  throw new Error('unbekanntes Werkzeug')
}

// ---------------------------------------------------------------------------
// Vorschläge (prüfen, Satz bauen) – ausgeführt wird erst bei „apply“
// ---------------------------------------------------------------------------
async function propose(c: Ctx, name: string, input: Record<string, unknown>): Promise<Proposal> {
  const { db, hid } = c
  const others = (id: string | null) => (id && id !== c.me.id ? [nameOf(c, id)] : [])
  const id = crypto.randomUUID()
  switch (name) {
    case 'aufgabe_anlegen': {
      const owner = memberFor(c, input.person)
      const d = date(input.datum, 'datum')
      if (!String(input.titel ?? '').trim()) throw new Error('titel fehlt')
      return { id, tool: name, input, summary: `Aufgabe für ${nameOf(c, owner)}: „${String(input.titel).trim()}“ bis ${nice(d)}`, betrifft: others(owner) }
    }
    case 'aufgabe_aendern': {
      const t = (must(await db.from('tasks').select('*').eq('id', String(input.id)).eq('household_id', hid), 'Aufgabe') ?? [])[0] as any
      if (!t) throw new Error('Aufgabe nicht gefunden')
      if (t.area !== 'casa') throw new Error('Das ist eine MWF-Aufgabe – die fasse ich nicht an.')
      const parts: string[] = []
      let owner = t.owner_member_id
      if (input.person !== undefined) { owner = memberFor(c, input.person); parts.push(`an ${nameOf(c, owner)}`) }
      if (input.datum !== undefined) parts.push(`auf ${nice(date(input.datum, 'datum'))}`)
      if (input.titel) parts.push(`Titel „${input.titel}“`)
      if (input.notiz !== undefined) parts.push('Notiz geändert')
      if (input.status === 'erledigt') parts.push('erledigt')
      else if (input.status) parts.push(String(input.status))
      if (input.archivieren) parts.push('ins Archiv')
      if (!parts.length) throw new Error('nichts zu ändern')
      // Erledigen und reines Archivieren lösen (wie in der App) keine Mitteilung aus
      const quiet = input.status === 'erledigt' || (input.archivieren && ['person', 'datum', 'titel', 'notiz', 'status'].every((k) => input[k] === undefined))
      return { id, tool: name, input, summary: `„${t.title}“: ${parts.join(', ')}`, betrifft: quiet ? [] : [...new Set([...others(owner), ...(input.person !== undefined ? others(t.owner_member_id) : [])])] }
    }
    case 'termin_anlegen': {
      const d = date(input.datum, 'datum')
      if (input.bis_datum) date(input.bis_datum, 'bis_datum')
      for (const k of ['start', 'ende']) if (input[k] && !TIME.test(String(input[k]))) throw new Error(`${k}: HH:MM`)
      const who = input.person ? memberFor(c, input.person) : null
      const art = String(input.art ?? 'termin')
      const label = art === 'eltern_weg' ? `${nameOf(c, who)} ist weg` : art === 'kita_zu' ? 'Kita zu' : art === 'valerie_weg' ? 'Valerie ist weg' : 'Termin'
      return { id, tool: name, input, summary: `${label}: „${input.titel}“ am ${nice(d)}${input.bis_datum ? ` bis ${nice(String(input.bis_datum))}` : ''}${input.start ? ` um ${input.start}` : ''}${who && art === 'termin' ? ` (${nameOf(c, who)})` : ''}`, betrifft: who && art !== 'eltern_weg' ? others(who) : c.members.filter((m) => m.id !== c.me.id && m.role === 'partner').map((m) => m.display_name) }
    }
    case 'termin_aendern': {
      const e = (must(await db.from('events').select('*').eq('id', String(input.id)).eq('household_id', hid), 'Termin') ?? [])[0] as any
      if (!e) throw new Error('Termin nicht gefunden')
      const parts = [input.datum ? `auf ${nice(date(input.datum, 'datum'))}` : null, input.start ? `um ${input.start}` : null, input.titel ? `Titel „${input.titel}“` : null, input.person !== undefined ? `für ${nameOf(c, memberFor(c, input.person))}` : null, input.notiz !== undefined ? 'Notiz' : null].filter(Boolean)
      if (!parts.length) throw new Error('nichts zu ändern')
      return { id, tool: name, input, summary: `Termin „${e.title}“: ${parts.join(', ')}`, betrifft: c.members.filter((m) => m.id !== c.me.id && m.role === 'partner').map((m) => m.display_name) }
    }
    case 'woche_abweichung': {
      const d = date(input.datum, 'datum')
      const label: Record<string, string> = { valerie_bringen: 'Valerie bringen', valerie_holen: 'Valerie holen', valerie_tag: 'Valerie tagsüber', anna_arbeit: 'Anna arbeitet', nachmittag: 'Nachmittag', abend_essen: 'Abendessen', abend_bett: 'ins Bett bringen', wochenende: 'Wochenende' }
      if (!label[String(input.slot)]) throw new Error('slot unbekannt')
      const wert = input.wert === null || input.wert === undefined || input.wert === '' ? null : String(input.wert)
      const m = wert ? c.members.find((x) => x.display_name.toLowerCase() === wert.toLowerCase()) : null
      return { id, tool: name, input, summary: `${nice(d)} · ${label[String(input.slot)]}: ${wert ?? 'offen – wer übernimmt?'}${input.uhrzeit ? ` um ${input.uhrzeit}` : ''}`, betrifft: m ? others(m.id) : c.members.filter((x) => x.id !== c.me.id && x.role === 'partner').map((x) => x.display_name) }
    }
    case 'mila_gericht_setzen': {
      const d = date(input.datum, 'datum')
      const r = (must(await db.from('mila_recipes').select('id,name').eq('id', String(input.rezept_id)).eq('household_id', hid), 'Gericht') ?? [])[0] as any
      if (!r) throw new Error('Gericht nicht im Fundus')
      return { id, tool: name, input, summary: `${nice(d)} ${input.mahlzeit === 'mittag' ? 'Mittag' : 'Abend'}: ${r.name}`, betrifft: [] }
    }
    case 'mila_gerichte_entfernen':
    case 'mila_gerichte_verschieben': {
      const von = date(input.von, 'von')
      const bis = date(input.bis, 'bis')
      let q = db.from('mila_week_days').select('id').eq('household_id', hid).gte('date', von).lte('date', bis).not('recipe_id', 'is', null)
      if (input.mahlzeit === 'mittag' || input.mahlzeit === 'abend') q = q.eq('meal', input.mahlzeit)
      const n = (must(await q, 'Essen') ?? []).length
      if (!n) throw new Error('In dem Zeitraum stehen keine Gerichte.')
      const t = Number(input.tage ?? 0)
      return { id, tool: name, input, summary: name === 'mila_gerichte_entfernen' ? `${n} ${n === 1 ? 'Gericht' : 'Gerichte'} von ${nice(von)} bis ${nice(bis)} aus dem Essensplan nehmen` : `${n} ${n === 1 ? 'Gericht' : 'Gerichte'} (${nice(von)}–${nice(bis)}) um ${Math.abs(t)} ${Math.abs(t) === 1 ? 'Tag' : 'Tage'} ${t > 0 ? 'nach hinten' : 'nach vorn'} schieben`, betrifft: [] }
    }
    case 'mila_kombo': {
      const k = await komboOf(c, monday(date(input.woche, 'woche')))
      if (!k.plan) throw new Error('In dieser Woche gibt es keine übernommene Kombo.')
      if (!k.movable.some((x: any) => x.status === 'offen')) throw new Error('In der Kombo ist nichts mehr offen.')
      const n = new Set(k.movable.filter((x: any) => x.status === 'offen').map((x: any) => x.recipe_id)).size
      const was = `${n} ${n === 1 ? 'Gericht' : 'Gerichte'}`
      if (input.aktion === 'verwerfen') return { id, tool: name, input, summary: `Kombo der Woche ab ${nice(k.plan.week)} verwerfen (${was} raus, Gekochtes bleibt), Einkaufszettel passt sich an`, betrifft: [] }
      const next = addDays(k.plan.week, 7)
      const taken = (must(await db.from('mila_week_plans').select('id').eq('household_id', hid).eq('week', next), 'Kombo') ?? []).length
      if (taken) throw new Error(`Für die Woche ab ${nice(next)} gibt es schon eine Wahl. Dann lieber verwerfen oder einzeln eintragen.`)
      return { id, tool: name, input, summary: `Kombo (${was}) auf die Woche ab ${nice(next)} schieben, Haltbarkeit und Einkaufszettel wandern mit`, betrifft: [] }
    }
    case 'einkaufsliste': {
      const w = monday(date(input.woche, 'woche'))
      return { id, tool: name, input, summary: input.aktion === 'leeren' ? `Einkaufszettel der Woche ab ${nice(w)}: offene Zeilen aus dem Plan entfernen` : `Einkaufszettel der Woche ab ${nice(w)} neu aus dem Essensplan erstellen`, betrifft: [] }
    }
    case 'freizeit_uebernehmen': {
      const t = (must(await db.from('freizeit_tipps').select('id,titel,start_tag').eq('id', String(input.tipp_id)).eq('household_id', hid), 'Tipp') ?? [])[0] as any
      if (!t) throw new Error('Tipp nicht gefunden')
      return { id, tool: name, input, summary: `Freizeit: „${t.titel}“ – machen wir, als Termin in die Woche${t.start_tag ? ` (${nice(t.start_tag)})` : ''}`, betrifft: c.members.filter((m) => m.id !== c.me.id && m.role === 'partner').map((m) => m.display_name) }
    }
    case 'anker_schritt': {
      const a = (must(await db.from('anchors').select('id,title,area').eq('id', String(input.anker_id)).eq('household_id', hid), 'Anker') ?? [])[0] as any
      if (!a) throw new Error('Anker nicht gefunden')
      if (a.area !== 'casa') throw new Error('Das ist ein MWF-Anker – den fasse ich nicht an.')
      const owner = memberFor(c, input.person)
      return { id, tool: name, input, summary: `Anker „${a.title}“: nächster Schritt „${input.titel}“ (${nameOf(c, owner)}, bis ${nice(date(input.datum, 'datum'))})`, betrifft: others(owner) }
    }
  }
  throw new Error('unbekanntes Werkzeug')
}

// ---------------------------------------------------------------------------
// Ausführen (mit Protokoll für „Rückgängig“)
// ---------------------------------------------------------------------------
interface LogEntry { table_name: string; row_id: string | null; op: 'insert' | 'update' | 'delete'; before: unknown; after: unknown; summary: string }

async function execute(c: Ctx, p: Proposal): Promise<LogEntry[]> {
  const { db, hid, me } = c
  const i = p.input
  const log: LogEntry[] = []
  const ins = async (table: string, row: Record<string, unknown>) => {
    const r = must(await db.from(table).insert(row).select('*').single(), table) as any
    log.push({ table_name: table, row_id: r.id, op: 'insert', before: null, after: r, summary: p.summary })
    return r
  }
  const upd = async (table: string, rowId: string, patch: Record<string, unknown>) => {
    const before = must(await db.from(table).select('*').eq('id', rowId).single(), table) as any
    const after = must(await db.from(table).update(patch).eq('id', rowId).select('*').single(), table) as any
    log.push({ table_name: table, row_id: rowId, op: 'update', before, after, summary: p.summary })
    return after
  }
  const del = async (table: string, row: any) => {
    must(await db.from(table).delete().eq('id', row.id), table)
    log.push({ table_name: table, row_id: row.id, op: 'delete', before: row, after: null, summary: p.summary })
  }

  switch (p.tool) {
    case 'aufgabe_anlegen':
      await ins('tasks', { household_id: hid, title: String(i.titel).trim(), owner_member_id: memberFor(c, i.person), due_date: i.datum, note: i.notiz ?? null, status: 'offen', area: 'casa', created_by: me.id, updated_by: me.id })
      break
    case 'aufgabe_aendern': {
      const patch: Record<string, unknown> = { updated_by: me.id }
      if (i.titel) patch.title = i.titel
      if (i.person !== undefined) patch.owner_member_id = memberFor(c, i.person)
      if (i.datum) patch.due_date = i.datum
      if (i.notiz !== undefined) patch.note = i.notiz || null
      if (i.status) {
        patch.status = i.status
        patch.done_at = i.status === 'erledigt' ? new Date().toISOString() : null
      }
      if (i.archivieren) patch.archived_at = new Date().toISOString()
      await upd('tasks', String(i.id), patch)
      break
    }
    case 'termin_anlegen':
      await ins('events', { household_id: hid, title: i.titel, date: i.datum, end_date: i.bis_datum ?? null, start_time: i.start ?? null, end_time: i.ende ?? null, member_id: i.person ? memberFor(c, i.person) : null, note: i.notiz ?? null, effect: i.art ?? 'termin', created_by: me.id, updated_by: me.id })
      break
    case 'termin_aendern': {
      const patch: Record<string, unknown> = { updated_by: me.id }
      if (i.titel) patch.title = i.titel
      if (i.datum) patch.date = i.datum
      if (i.bis_datum !== undefined) patch.end_date = i.bis_datum || null
      if (i.start !== undefined) patch.start_time = i.start || null
      if (i.ende !== undefined) patch.end_time = i.ende || null
      if (i.person !== undefined) patch.member_id = memberFor(c, i.person)
      if (i.notiz !== undefined) patch.note = i.notiz || null
      await upd('events', String(i.id), patch)
      break
    }
    case 'woche_abweichung': {
      const cur = (must(await db.from('week_overrides').select('*').eq('household_id', hid).eq('date', i.datum).eq('slot', i.slot), 'Abweichung') ?? [])[0] as any
      const row = { value: i.wert ?? null, at: i.uhrzeit ?? null, note: i.notiz ?? null, updated_by: me.id }
      if (cur) await upd('week_overrides', cur.id, row)
      else await ins('week_overrides', { household_id: hid, date: i.datum, slot: i.slot, created_by: me.id, ...row })
      break
    }
    case 'mila_gericht_setzen': {
      const cur = (must(await db.from('mila_week_days').select('*').eq('household_id', hid).eq('date', i.datum).eq('meal', i.mahlzeit), 'Essen') ?? [])[0] as any
      const row = { recipe_id: i.rezept_id, free_text: null, is_leftover: false, servings: i.portionen ?? null, variant: 'original', updated_by: me.id }
      if (cur) await upd('mila_week_days', cur.id, row)
      else await ins('mila_week_days', { household_id: hid, date: i.datum, meal: i.mahlzeit, added_to_list: false, created_by: me.id, ...row })
      break
    }
    case 'mila_gerichte_entfernen': {
      let q = db.from('mila_week_days').select('*').eq('household_id', hid).gte('date', i.von).lte('date', i.bis)
      if (i.mahlzeit === 'mittag' || i.mahlzeit === 'abend') q = q.eq('meal', i.mahlzeit)
      for (const r of must(await q, 'Essen') ?? []) await del('mila_week_days', r)
      break
    }
    case 'mila_gerichte_verschieben': {
      const t = Number(i.tage)
      const rows = (must(await db.from('mila_week_days').select('*').eq('household_id', hid).gte('date', i.von).lte('date', i.bis), 'Essen') ?? []) as any[]
      rows.sort((a, b) => (t > 0 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
      for (const r of rows) {
        const target = addDays(r.date, t)
        const taken = (must(await db.from('mila_week_days').select('id').eq('household_id', hid).eq('date', target).eq('meal', r.meal), 'Essen') ?? []).length
        if (taken) continue // dort steht schon etwas: dieses Gericht bleibt, wo es ist
        await upd('mila_week_days', r.id, { date: target, updated_by: me.id })
      }
      break
    }
    case 'mila_kombo': {
      const k = await komboOf(c, monday(String(i.woche)))
      if (!k.plan || !k.movable.length) throw new Error('In der Kombo ist nichts mehr offen.')
      const old = k.plan.week as string
      const children = k.movable.filter((x: any) => x.parent_id)
      const parents = k.movable.filter((x: any) => !x.parent_id)
      let next: string | null = null
      if (i.aktion === 'verwerfen') {
        await upd('mila_week_plans', k.plan.id, { status: 'verworfen' })
        for (const r of [...children, ...parents]) await del('mila_plan_items', r)
      } else {
        next = addDays(old, 7)
        const shift = (d: string | null) => (d ? addDays(String(d).slice(0, 10), 7) : null)
        const rest = k.items.length > k.movable.length // schon Gekochtes/Eingefrorenes bleibt in dieser Woche
        let target = k.plan.id
        if (rest) {
          const { id: _i, created_at: _c, updated_at: _u, ...copy } = k.plan
          target = (await ins('mila_week_plans', { ...copy, week: next, einkauf_tag: shift(k.plan.einkauf_tag), prep_tag: shift(k.plan.prep_tag), prep_done: [] })).id
        } else {
          await upd('mila_week_plans', k.plan.id, { week: next, einkauf_tag: shift(k.plan.einkauf_tag), prep_tag: shift(k.plan.prep_tag), prep_done: [] })
        }
        for (const r of [...parents, ...children]) await upd('mila_plan_items', r.id, { plan_id: target, frist_bis: shift(r.frist_bis), geplant_am: null })
      }
      // Einkaufszettel: alte Woche (und ggf. neue) aus dem Plan neu aufbauen, Abgehaktes und Eigenes bleibt
      const bought: string[] = [] // schon Gekauftes der alten Woche kommt nicht noch einmal auf den neuen Zettel
      for (const w of next ? [old, next] : [old]) {
        const items = (must(await db.from('mila_shopping_items').select('*').eq('household_id', hid).eq('source_week', S.weekKey(w)), 'Einkauf') ?? []) as any[]
        bought.push(...items.filter((x) => x.checked).map((x) => x.name.toLowerCase()))
        for (const r of items.filter((x) => !x.checked && x.source_label)) await del('mila_shopping_items', r)
        for (const row of await shoppingRows(c, w, [...bought])) await ins('mila_shopping_items', row)
      }
      break
    }
    case 'einkaufsliste': {
      const w = monday(String(i.woche))
      const wk = S.weekKey(w)
      const items = (must(await db.from('mila_shopping_items').select('*').eq('household_id', hid).eq('source_week', wk), 'Einkauf') ?? []) as any[]
      for (const r of items.filter((x) => !x.checked && x.source_label)) await del('mila_shopping_items', r)
      if (i.aktion === 'neu') {
        for (const row of await shoppingRows(c, w, items.filter((x) => x.checked).map((x) => x.name.toLowerCase()))) await ins('mila_shopping_items', row)
      }
      break
    }
    case 'freizeit_uebernehmen': {
      const tip = must(await db.from('freizeit_tipps').select('*').eq('id', String(i.tipp_id)).single(), 'Tipp') as any
      const radar = tip.radar_id ? (must(await db.from('freizeit_radar').select('*').eq('id', tip.radar_id), 'Radar') ?? [])[0] : null
      const ev = S.tippEvent(tip, radar)
      let eventId = tip.event_id
      if (ev && !eventId) eventId = (await ins('events', { household_id: hid, created_by: me.id, updated_by: me.id, member_id: null, effect: 'termin', ...ev })).id
      await upd('freizeit_tipps', tip.id, { status: 'machen', event_id: eventId, feedback_von: me.id, feedback_am: new Date().toISOString() })
      break
    }
    case 'anker_schritt': {
      const owner = memberFor(c, i.person)
      const step = (must(await db.from('tasks').select('*').eq('anchor_id', String(i.anker_id)).eq('is_step', true).neq('status', 'erledigt'), 'Schritt') ?? [])[0] as any
      if (step) await upd('tasks', step.id, { title: i.titel, owner_member_id: owner, due_date: i.datum, updated_by: me.id })
      else await ins('tasks', { household_id: hid, title: i.titel, owner_member_id: owner, due_date: i.datum, status: 'offen', area: 'casa', anchor_id: i.anker_id, is_step: true, created_by: me.id, updated_by: me.id })
      await upd('anchors', String(i.anker_id), { ask_next: false, moved_at: new Date().toISOString(), updated_by: me.id })
      break
    }
    default:
      throw new Error('unbekannter Vorschlag')
  }
  return log
}

/** Übernommene Kombo einer Woche mit allen Gerichten; „movable“ = noch nicht gekocht oder eingefroren */
async function komboOf(c: Ctx, w: string) {
  const plan = (must(await c.db.from('mila_week_plans').select('*').eq('household_id', c.hid).eq('week', w), 'Kombo') ?? [])[0] as any
  if (!plan?.adopted_at || plan.status !== 'aktiv') return { plan: null, items: [], movable: [] } as { plan: any; items: any[]; movable: any[] }
  const items = (must(await c.db.from('mila_plan_items').select('*').eq('plan_id', plan.id), 'Kombo') ?? []) as any[]
  return { plan, items, movable: items.filter((x) => x.status !== 'gekocht' && x.status !== 'eingefroren') }
}

/** Einkaufszettel aus dem Plan der Woche (wie in der App): Kombo (offen) + eingetragene Tage ab heute */
async function shoppingRows(c: Ctx, w: string, bought: string[]) {
  const { db, hid, today, me } = c
  const end = addDays(w, 6)
  const plan = (must(await db.from('mila_week_plans').select('*').eq('household_id', hid).eq('week', w), 'Kombo') ?? [])[0] as any
  const kItems = plan?.adopted_at && plan.status === 'aktiv' ? ((must(await db.from('mila_plan_items').select('*').eq('plan_id', plan.id), 'Kombo') ?? []) as any[]) : []
  const live = kItems.filter((x) => x.status === 'offen' && x.slot !== 'reste')
  const kRec = new Set(kItems.filter((x) => x.status === 'offen' || x.status === 'gekocht').map((x) => x.recipe_id))
  const days = ((must(await db.from('mila_week_days').select('*').eq('household_id', hid).gte('date', w).lte('date', end), 'Essen') ?? []) as any[]).filter((x) => x.recipe_id && x.date >= today && !kRec.has(x.recipe_id))
  const rids = [...new Set([...days.map((x) => x.recipe_id), ...live.map((x) => x.recipe_id)])]
  if (!rids.length) return []
  const recipes = (must(await db.from('mila_recipes').select('*').in('id', rids), 'Gerichte') ?? []) as any[]
  const ings = (must(await db.from('mila_ingredients').select('*').in('recipe_id', rids), 'Zutaten') ?? []) as any[]
  const shopRecipes = [...recipes]
  const shopIngs = [...ings]
  const keyOf = (rid: string, v?: string | null) => {
    const r = recipes.find((x) => x.id === rid)
    if (!r || !v || v === 'original') return rid
    const k = `${rid}:${v}`
    if (!shopRecipes.some((x) => x.id === k)) {
      shopRecipes.push({ ...r, id: k })
      shopIngs.push(...S.variantShopping(r, ings.filter((x) => x.recipe_id === rid), v).map((x: any) => ({ ...x, recipe_id: k })))
    }
    return k
  }
  const slots = [
    ...days.map((x) => ({ date: x.date, meal: x.meal ?? 'abend', recipe_id: keyOf(x.recipe_id, x.variant), leftover: !!x.is_leftover, servings: x.servings ?? recipes.find((r) => r.id === x.recipe_id)?.portions ?? 2 })),
    ...live.map((x) => ({ date: plan.einkauf_tag ?? w, meal: x.slot === 'abend' ? 'abend' : 'mittag', recipe_id: keyOf(x.recipe_id, x.variante), leftover: false, servings: x.portionen + (kItems.find((y) => y.parent_id === x.id && y.status === 'offen')?.portionen ?? 0) })),
  ]
  return S.shoppingFor(w, slots, shopRecipes, shopIngs)
    .map((row: any) => {
      const ids = [...new Set(row.source_recipe_ids.map((x: string) => x.split(':')[0]))] as string[]
      const fromKombo = ids.some((x) => live.some((y) => y.recipe_id === x))
      const names = ids.map((x) => S.shortName(recipes.find((r) => r.id === x)?.name ?? '')).filter(Boolean)
      return { ...row, source_recipe_ids: ids, source_label: fromKombo ? (names.length > 2 ? `${names.length} Gerichte` : names.join(' + ')) : row.source_label }
    })
    .filter((row: any) => !bought.includes(row.name.toLowerCase()))
    .map((row: any) => ({ household_id: hid, ...row, added_by: me.id, checked: false, checked_by: null, checked_at: null }))
}

// ---------------------------------------------------------------------------
// Rückgängig
// ---------------------------------------------------------------------------
async function undo(c: Ctx, batchId: string) {
  const { db, hid } = c
  const since = new Date(Date.now() - UNDO_MINUTES * 60000).toISOString()
  const rows = (must(await db.from('manager_log').select('*').eq('household_id', hid).eq('batch_id', batchId).eq('member_id', c.me.id).is('undone_at', null).gte('created_at', since).order('position', { ascending: false }), 'Verlauf') ?? []) as any[]
  if (!rows.length) throw new Error('Diese Änderung lässt sich nicht mehr zurücknehmen.')
  for (const r of rows) {
    if (r.op === 'insert') must(await db.from(r.table_name).delete().eq('id', r.row_id), r.table_name)
    else if (r.op === 'update') {
      const { id: _id, created_at: _c, updated_at: _u, ...back } = r.before ?? {}
      void _id
      void _c
      void _u
      must(await db.from(r.table_name).update(back).eq('id', r.row_id), r.table_name)
    } else if (r.op === 'delete') must(await db.from(r.table_name).insert(r.before), r.table_name)
  }
  must(await db.from('manager_log').update({ undone_at: new Date().toISOString() }).eq('batch_id', batchId).eq('member_id', c.me.id), 'Verlauf')
  return rows.length
}

// ---------------------------------------------------------------------------
// Chat mit Claude (Werkzeug-Schleife)
// ---------------------------------------------------------------------------
async function chat(c: Ctx, history: { role: 'user' | 'assistant'; text: string }[]) {
  if (!API_KEY) return { text: 'Der Manager ist noch nicht eingerichtet: Es fehlt der API-Schlüssel.', proposals: [] }
  const client = new Anthropic({ apiKey: API_KEY })
  const partner = c.members.find((m) => m.id !== c.me.id && m.role === 'partner')
  const context = `Heute ist ${nice(c.today)} (${c.today}). Die aktuelle Woche geht von ${monday(c.today)} bis ${addDays(monday(c.today), 6)}. Du sprichst mit ${c.me.display_name}${partner ? `; die andere Person ist ${partner.display_name}` : ''}.`
  // Nur Text-Verlauf (letzte 30 Nachrichten); muss mit einer Nutzer-Nachricht beginnen
  const msgs = history.filter((m) => m.text?.trim()).slice(-30)
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  const messages: any[] = msgs.map((m) => ({ role: m.role, content: m.text }))
  const proposals: Proposal[] = []
  let text = ''

  for (let step = 0; step < MAX_STEPS; step++) {
    const { data: ok } = await c.db.rpc('manager_take_call', { p_limit: DAILY_LIMIT })
    if (!ok) return { text: 'Für heute hab ich mein Limit erreicht. Morgen bin ich wieder da.', proposals }
    let res: any
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: [
          { type: 'text', text: SYSTEM },
          { type: 'text', text: context },
        ],
        tools: [...READ_TOOLS, ...WRITE_TOOLS],
        messages,
      } as any)
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return { text: 'Gerade ist viel los. Versuch es gleich noch mal.', proposals }
      if (err instanceof Anthropic.AuthenticationError) return { text: 'Der API-Schlüssel stimmt nicht. Bitte in Supabase prüfen.', proposals }
      if (err instanceof Anthropic.APIError) return { text: `Das hat nicht geklappt (${err.status}). Versuch es gleich noch mal.`, proposals }
      throw err
    }
    if (res.stop_reason === 'refusal') return { text: 'Dabei kann ich nicht helfen.', proposals: [] }
    text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim() || text
    const calls = res.content.filter((b: any) => b.type === 'tool_use')
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content })
      continue
    }
    if (res.stop_reason !== 'tool_use' || !calls.length) break
    messages.push({ role: 'assistant', content: res.content })
    const results = []
    for (const call of calls) {
      try {
        if (WRITE_NAMES.has(call.name)) {
          const p = await propose(c, call.name, (call.input ?? {}) as Record<string, unknown>)
          proposals.push(p)
          results.push({ type: 'tool_result', tool_use_id: call.id, content: `Vorschlag notiert: ${p.summary}.${p.betrifft.length ? ` Betrifft ${p.betrifft.join(' und ')} (bekommt eine Mitteilung).` : ' Niemand bekommt dafür eine Mitteilung.'} Wird erst nach Okay ausgeführt.` })
        } else {
          const out = await runRead(c, call.name, (call.input ?? {}) as Record<string, unknown>)
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out).slice(0, 30000) })
        }
      } catch (err) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: (err as Error).message })
      }
    }
    messages.push({ role: 'user', content: results })
  }
  return { text: text || (proposals.length ? 'Das würde ich so machen:' : 'Hm, dazu fällt mir gerade nichts ein.'), proposals }
}

// ---------------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'nur POST' })
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json(401, { error: 'nicht angemeldet' })
  const db = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await db.auth.getUser(auth.slice(7))
  if (!u?.user) return json(401, { error: 'nicht angemeldet' })
  const { data: mine } = await db.from('members').select('id,display_name,role,household_id').eq('user_id', u.user.id)
  const me = (mine ?? [])[0] as Member | undefined
  if (!me) return json(403, { error: 'kein Casa-Mitglied' })
  const { data: members } = await db.from('members').select('id,display_name,role,household_id').eq('household_id', me.household_id)
  const c: Ctx = { db, me, members: (members ?? []) as Member[], hid: me.household_id, today: berlinToday() }

  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'chat') {
      const history = Array.isArray(body.messages) ? body.messages : []
      return json(200, await chat(c, history))
    }
    if (body.action === 'apply') {
      const list = (Array.isArray(body.proposals) ? body.proposals : []) as Proposal[]
      if (!list.length) return json(400, { error: 'nichts zu tun' })
      // Vorschläge erneut prüfen (Text aus der App wird nicht übernommen)
      const checked: Proposal[] = []
      for (const p of list) {
        if (!WRITE_NAMES.has(p.tool)) return json(400, { error: 'unbekannter Vorschlag' })
        checked.push(await propose(c, p.tool, p.input ?? {}))
      }
      const batch = crypto.randomUUID()
      const done: string[] = []
      let pos = 0
      let failed: string | null = null
      for (const p of checked) {
        try {
          const entries = await execute(c, p)
          for (const e of entries) {
            must(await db.from('manager_log').insert({ household_id: c.hid, member_id: me.id, batch_id: batch, position: pos++, ...e }), 'Verlauf')
          }
          done.push(p.summary)
        } catch (err) {
          failed = `${p.summary}: ${(err as Error).message}`
          break
        }
      }
      return json(200, { ok: !failed, batch_id: pos ? batch : null, done, failed })
    }
    if (body.action === 'undo') {
      const n = await undo(c, String(body.batch_id ?? ''))
      return json(200, { ok: true, undone: n })
    }
    return json(400, { error: 'unbekannte Aktion' })
  } catch (err) {
    return json(500, { error: (err as Error).message })
  }
})
