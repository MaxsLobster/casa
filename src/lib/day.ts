// Ein Tag in Klartext: wer Valerie bringt und holt (auch wenn der Tag anders läuft), Abend, offene Anfragen.
// Gemeinsame Rechnung für Heute (Tageskarte, „Morgen · Fr“) und Woche (eine Zeile pro Tag).
import type { Person, SlotRequest } from './types'
import { addDays, spanLabel, uhr, weekdayShort, type ISODate } from './dates'
import type { DayEffects } from './effects'
import { personName } from './effects'
import { verb, type DayState, type Voice } from './week'

export type SegKind = 'plain' | 'changed' | 'open' | 'ask'
export interface Seg {
  text: string
  kind: SegKind
}

/** „Heute“, „Morgen · Fr“, sonst „Sa 22.11.“ – ein Tag, ein Wort */
export function dayWord(date: ISODate, today: ISODate): string {
  if (date === today) return 'Heute'
  if (date === addDays(today, 1)) return `Morgen · ${weekdayShort(date)}`
  const [, m, d] = date.split('-')
  return `${weekdayShort(date)} ${Number(d)}.${Number(m)}.`
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const isMe = (value: string | null, v: Voice) => !!value && !!v.me && value.trim().toLowerCase() === v.me.display_name.trim().toLowerCase()
const nameOf = (id: string, v: Voice) => (v.me?.id === id ? 'du' : (v.members.find((m) => m.id === id)?.display_name ?? ''))

/** Offene Anfrage „Kannst du übernehmen?“ für diesen Tag und Slot */
export function openRequest(requests: SlotRequest[], date: ISODate, slot: string): SlotRequest | null {
  return requests.find((r) => r.date === date && r.slot === slot && r.status === 'offen') ?? null
}

/** „Anna gefragt“ (ich habe gefragt) / „Max fragt dich“ */
export function askText(r: SlotRequest, v: Voice): string {
  const from = nameOf(r.from_member_id, v)
  const to = v.me?.id === r.to_member_id ? 'dich' : nameOf(r.to_member_id, v)
  return from === 'du' ? `${to} gefragt` : `${from} fragt ${to}`
}

export interface ValerieRow {
  slot: 'valerie_bringen' | 'valerie_holen'
  label: 'Bringen' | 'Holen'
  /** Klartext ohne Uhrzeit: „Du bringst“, „Anna holt“, „offen“ */
  text: string
  at: string | null
  value: string | null
  mine: boolean
  open: boolean
  changed: boolean
  request: SlotRequest | null
}

export interface ValerieDay {
  /** Ausnahme statt Normalwoche: „Valerie krank · Anna ist bei ihr“, „Valerie bei Oma (So–Di)“ */
  headline: string | null
  /** Kita zu / krank, aber noch niemand eingetragen */
  needsWho: boolean
  rows: ValerieRow[]
}

/** Wer hat Valerie an diesem Tag? Eine Ausnahme ersetzt die Normalwoche-Zeile, statt sie leer zu lassen. */
export function valerieDay(date: ISODate, state: DayState, fx: DayEffects, v: Voice, people: Person[], requests: SlotRequest[]): ValerieDay {
  const vw = fx.valerieWeg
  if (vw) {
    const pn = personName(vw, people)
    let text = pn ? `Valerie bei ${pn}` : vw.title || 'Valerie ist weg'
    if (vw.occ_date !== vw.occ_end) text += ` (${spanLabel(vw.occ_date, vw.occ_end)})`
    const extra: string[] = []
    if (fx.isFirst && vw.dropoff_by) extra.push(`${verb(vw.dropoff_by, v, 'bringst', 'bringt')} sie hin${vw.dropoff_at ? ` ${uhr(vw.dropoff_at)}` : ''}`)
    if (fx.isLast && vw.pickup_by) extra.push(`${verb(vw.pickup_by, v, 'holst', 'holt')} sie ab${vw.pickup_at ? ` ${uhr(vw.pickup_at)}` : ''}`)
    return { headline: [text, ...extra].join(' · '), needsWho: (fx.isFirst && !vw.dropoff_by) || (fx.isLast && !vw.pickup_by), rows: [] }
  }
  if (fx.kitaZu) {
    const title = fx.kitaZu.title?.trim() || 'Kita zu'
    const t = state.valerie_tag
    if (t?.value) {
      const who = /^beide$/i.test(t.value) ? 'ihr seid beide bei ihr' : isMe(t.value, v) ? 'du hast sie' : `${t.value} hat sie`
      return { headline: `${title} · ${who}`, needsWho: false, rows: [] }
    }
    return { headline: `${title} · wer hat sie?`, needsWho: true, rows: [] }
  }
  const rows: ValerieRow[] = []
  for (const [slot, label, du, er] of [
    ['valerie_bringen', 'Bringen', 'bringst', 'bringt'],
    ['valerie_holen', 'Holen', 'holst', 'holt'],
  ] as const) {
    const s = state[slot]
    if (!s) continue
    const open = s.is_open || !s.value
    rows.push({
      slot,
      label,
      text: open ? 'offen' : cap(verb(s.value, v, du, er)),
      at: s.at,
      value: s.value,
      mine: !open && isMe(s.value, v),
      open,
      changed: s.overridden,
      request: openRequest(requests, date, slot),
    })
  }
  return { headline: null, needsWho: false, rows }
}

/** Abend in einem Stück: „du kochst“, „Abend offen“, „Essen bei Freunden“ */
function abendSeg(state: DayState, v: Voice, date: ISODate, requests: SlotRequest[]): Seg | null {
  const e = state.abend_essen
  const b = state.abend_bett
  if (!e && !b) return null
  const eOpen = !!e && (e.is_open || !e.value)
  const bOpen = !!b && (b.is_open || !b.value)
  const ask = openRequest(requests, date, 'abend_essen') ?? openRequest(requests, date, 'abend_bett')
  if (ask) return { text: `Abend: ${askText(ask, v)}`, kind: 'ask' }
  if (eOpen && (bOpen || !b)) return { text: 'Abend offen', kind: 'open' }
  if (eOpen) return { text: 'Essen offen', kind: 'open' }
  if (e?.value) {
    const person = /^[A-ZÄÖÜ][a-zäöüß]+$/.test(e.value.trim()) || v.members.some((m) => m.display_name.toLowerCase() === e.value!.trim().toLowerCase())
    return { text: person ? verb(e.value, v, 'kochst', 'kocht') : `Essen ${e.value}`, kind: e.overridden ? 'changed' : 'plain' }
  }
  return null
}

/** Eine Zeile pro Tag, z. B. „Anna bringt · Max holt 14 Uhr · Abend offen“ (Ausnahmen und Anfragen direkt sichtbar) */
export function daySegments(date: ISODate, state: DayState, fx: DayEffects, v: Voice, people: Person[], requests: SlotRequest[]): Seg[] {
  const out: Seg[] = []
  if (state.wochenende) {
    out.push(state.wochenende.is_open ? { text: 'Familientag + ein Tag geteilt', kind: 'open' } : { text: state.wochenende.value ?? '', kind: state.wochenende.overridden ? 'changed' : 'plain' })
  }
  const vd = valerieDay(date, state, fx, v, people, requests)
  if (vd.headline) out.push({ text: vd.headline, kind: vd.needsWho ? 'open' : 'changed' })
  for (const r of vd.rows) {
    if (r.request) out.push({ text: `${r.label}: ${askText(r.request, v)}`, kind: 'ask' })
    else if (r.open) out.push({ text: `${r.label} offen`, kind: 'open' })
    else out.push({ text: r.text.replace(/^Du /, 'du ') + (r.at && (r.slot === 'valerie_holen' || r.changed) ? ` ${uhr(r.at)}` : ''), kind: r.changed ? 'changed' : 'plain' })
  }
  for (const a of fx.away) {
    if (a.occ.effect === 'messe') continue
    out.push({ text: v.me?.id === a.member.id ? 'du bist weg' : `${a.member.display_name} weg`, kind: 'changed' })
  }
  if (!state.wochenende) {
    const ab = abendSeg(state, v, date, requests)
    if (ab) out.push(ab)
  }
  // Erste Zeile groß, Rest klein lassen wir der Ansicht; hier nur der Anfang groß
  if (out[0]) out[0] = { ...out[0], text: cap(out[0].text) }
  return out.filter((s) => s.text)
}

export const segText = (segs: Seg[]) => segs.map((s) => s.text).join(' · ')
