import type { Member, NormalWeekRow, Slot, WeekOverride } from './types'
import { uhr, weekday, type ISODate } from './dates'

export interface SlotState {
  slot: Slot
  value: string | null
  at: string | null
  is_open: boolean
  note: string | null
  overridden: boolean
  override?: WeekOverride
  template?: NormalWeekRow
}

export type DayState = Partial<Record<Slot, SlotState>>

export const SLOT_LABEL: Record<Slot, string> = {
  valerie_bringen: 'Valerie bringen',
  valerie_holen: 'Valerie holen',
  anna_arbeit: 'Anna',
  nachmittag: 'Nachmittag',
  abend_essen: 'Abendessen',
  abend_bett: 'Ins Bett bringen',
  wochenende: 'Wochenende',
}

/** Slots, bei denen der Wert eine Person ist */
export const PERSON_SLOTS: Slot[] = ['valerie_bringen', 'valerie_holen', 'abend_essen', 'abend_bett']
export const TIME_SLOTS: Slot[] = ['valerie_holen']

export const SLOT_ORDER: Slot[] = ['valerie_bringen', 'valerie_holen', 'anna_arbeit', 'nachmittag', 'abend_essen', 'abend_bett', 'wochenende']

/** Wochentags-Vorlage + Abweichungen für ein Datum zusammenführen */
export function dayState(date: ISODate, template: NormalWeekRow[], overrides: WeekOverride[]): DayState {
  const wd = weekday(date)
  const out: DayState = {}
  for (const row of template) {
    if (row.weekday !== wd) continue
    out[row.slot] = {
      slot: row.slot,
      value: row.value,
      at: row.at,
      is_open: row.is_open,
      note: row.note,
      overridden: false,
      template: row,
    }
  }
  for (const o of overrides) {
    if (o.date !== date) continue
    const base = out[o.slot]
    out[o.slot] = {
      slot: o.slot,
      value: o.value,
      at: o.at ?? base?.at ?? null,
      is_open: false,
      note: o.note,
      overridden: true,
      override: o,
      template: base?.template,
    }
  }
  return out
}

/** Nur die Vorlage (für den Reiter „Normalwoche") */
export function templateState(wd: number, template: NormalWeekRow[]): DayState {
  const out: DayState = {}
  for (const row of template) {
    if (row.weekday !== wd) continue
    out[row.slot] = { slot: row.slot, value: row.value, at: row.at, is_open: row.is_open, note: row.note, overridden: false, template: row }
  }
  return out
}

// ---------------------------------------------------------------------------
// Formulierungen aus Sicht des eingeloggten Nutzers („du")
// ---------------------------------------------------------------------------

export interface Voice {
  me: Member | null
  members: Member[]
}

function isMe(value: string | null, v: Voice): boolean {
  if (!value || !v.me) return false
  return value.trim().toLowerCase() === v.me.display_name.trim().toLowerCase()
}

function isPerson(value: string | null, v: Voice): boolean {
  if (!value) return false
  const t = value.trim().toLowerCase()
  if (v.members.some((m) => m.display_name.toLowerCase() === t)) return true
  return /^[A-ZÄÖÜ][a-zäöüß]+$/.test(value.trim()) // ein einzelner Name wie „Oma", „Theresa"
}

/** „du bringst" / „Max bringt" */
export function verb(value: string | null, v: Voice, du: string, er: string): string {
  if (isMe(value, v)) return `du ${du}`
  return `${value} ${er}`
}

/** „du" / „Anna" */
export function name(value: string | null, v: Voice): string {
  if (isMe(value, v)) return 'du'
  return value ?? ''
}

function possessive(value: string, v: Voice): string {
  if (isMe(value, v)) return 'dein'
  return `${value}s`
}

export interface DayLine {
  label: string
  text: string
  slots: Slot[]
}

/** Zeile „Valerie: …" */
export function valerieLine(d: DayState, v: Voice, withNote = true): string | null {
  const b = d.valerie_bringen
  const h = d.valerie_holen
  if (!b && !h) return null
  const parts: string[] = []
  if (b?.value) parts.push(verb(b.value, v, 'bringst', 'bringt'))
  if (h?.value) {
    const t = h.at ? ` um ${uhr(h.at)}` : ''
    parts.push(verb(h.value, v, 'holst', 'holt') + t)
  } else if (h?.is_open) {
    parts.push('Abholen offen')
  }
  let s = parts.join(', ')
  if (!withNote) return s
  if (h?.note && !h.overridden) s += `. ${h.note}`
  else if (h?.note && h.overridden) s += ` (${h.note})`
  return s
}

/** Zeile „Anna: Arbeit, 8 Stunden" */
export function arbeitLine(d: DayState, v: Voice): { label: string; text: string } | null {
  const a = d.anna_arbeit
  if (!a) return null
  const anna = v.members.find((m) => m.display_name.toLowerCase() === 'anna')
  const label = anna && v.me?.id === anna.id ? 'Du' : 'Anna'
  const val = (a.value ?? '').trim()
  let text: string
  if (/^frei/i.test(val)) text = 'Freier Tag'
  else if (/^\d+\s*std/i.test(val)) text = `Arbeit, ${val.replace(/\s*std\.?$/i, '')} Stunden`
  else text = val || 'offen'
  if (a.note) text += ` · ${a.note}`
  return { label, text }
}

/** Zeile „Abend: du kochst, Anna bringt ins Bett" */
export function abendLine(d: DayState, v: Voice): string | null {
  const e = d.abend_essen
  const b = d.abend_bett
  if (!e && !b) return null
  const eOpen = !!e?.is_open || (!!e && !e.value)
  const bOpen = !!b?.is_open || (!!b && !b.value)
  if (eOpen && bOpen) return 'Essen und Bettgehen offen'
  const parts: string[] = []
  if (e) {
    if (eOpen) parts.push('Essen offen')
    else if (isPerson(e.value, v)) {
      if (b && !bOpen && b.value === e.value) {
        return `${verb(e.value, v, 'kochst', 'kocht')} und ${isMe(e.value, v) ? 'bringst' : 'bringt'} ins Bett` + (b.note ? ` (${b.note})` : '')
      }
      parts.push(verb(e.value, v, 'kochst', 'kocht'))
    } else parts.push(`Essen ${e.value}`)
  }
  if (b) {
    if (bOpen) parts.push('Bettgehen offen')
    else if (isPerson(b.value, v)) parts.push(verb(b.value, v, 'bringst ins Bett', 'bringt ins Bett') + (b.note ? ` (${b.note})` : ''))
    else parts.push(`Bett: ${b.value}`)
  }
  return parts.join(', ')
}

/** Alle Detailzeilen eines Tages */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function dayLines(d: DayState, v: Voice): DayLine[] {
  const lines: DayLine[] = []
  const val = valerieLine(d, v)
  if (val) lines.push({ label: 'Valerie', text: cap(val), slots: ['valerie_bringen', 'valerie_holen'] })
  const arb = arbeitLine(d, v)
  if (arb) lines.push({ label: arb.label, text: arb.text, slots: ['anna_arbeit'] })
  if (d.nachmittag?.value) lines.push({ label: 'Nachmittag', text: d.nachmittag.value, slots: ['nachmittag'] })
  const ab = abendLine(d, v)
  if (ab) lines.push({ label: 'Abend', text: cap(ab), slots: ['abend_essen', 'abend_bett'] })
  if (d.wochenende?.value) lines.push({ label: 'Wochenende', text: d.wochenende.value, slots: ['wochenende'] })
  return lines
}

/** Kurze Zusammenfassung für die zugeklappte Zeile, z. B. „Oma holt · du kochst" */
export function daySummary(d: DayState, v: Voice): string {
  const parts: string[] = []
  if (d.wochenende) {
    return d.wochenende.is_open ? 'Familientag + ein Tag geteilt' : (d.wochenende.value ?? '')
  }
  const h = d.valerie_holen
  if (h?.value) parts.push(verb(h.value, v, 'holst', 'holt'))
  const a = d.anna_arbeit
  if (a && /^frei/i.test(a.value ?? '')) parts.push(`${possessive('Anna', v) === 'dein' ? 'Dein' : 'Annas'} freier Tag`)
  if (d.nachmittag?.value) parts.push(d.nachmittag.value.split(/[,·]/)[0].replace(/\s+\d.*$/, '').trim())
  const e = d.abend_essen
  const b = d.abend_bett
  const eOpen = !!e?.is_open || (!!e && !e.value)
  const bOpen = !!b?.is_open || (!!b && !b.value)
  if (eOpen && bOpen) parts.push('Abend offen')
  else if (eOpen) parts.push('Essen offen')
  else if (e?.value && isPerson(e.value, v)) parts.push(verb(e.value, v, 'kochst', 'kocht'))
  else if (e?.value) parts.push(`Essen ${e.value}`)
  return parts.slice(0, 3).join(' · ')
}

/** Offene Punkte eines Tages als Hinweis, z. B. „Offen: wer kocht?" */
export function openHints(d: DayState): string[] {
  const hints: string[] = []
  const es = d.abend_essen
  const bt = d.abend_bett
  if (es?.is_open && bt?.is_open) hints.push('Essen und Bettgehen')
  else {
    if (es?.is_open) hints.push(es.note || 'Essen')
    if (bt?.is_open) hints.push(bt.note || 'Bettgehen')
  }
  for (const s of SLOT_ORDER) {
    if (s === 'abend_essen' || s === 'abend_bett') continue
    const x = d[s]
    if (x?.is_open) hints.push(x.note || SLOT_LABEL[s])
  }
  return hints
}

export function hasOpen(d: DayState): boolean {
  return SLOT_ORDER.some((s) => d[s]?.is_open)
}

export function hasOverride(d: DayState): boolean {
  return SLOT_ORDER.some((s) => d[s]?.overridden)
}
