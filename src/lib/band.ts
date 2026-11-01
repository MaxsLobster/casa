// Mini-Band / Zeitstrahl 6–22 Uhr: Gold = Valerie versorgt, Navy = Termine.
// Wird von „Heute" (Zeitstrahl) und „Woche" (Band pro Tag) gleich berechnet.

import type { Member } from './types'
import type { DayState } from './week'
import { isMultiDay, type Occurrence } from './recur'
import type { ISODate } from './dates'

export const BAND_START = 6
export const BAND_END = 22

export interface Seg {
  from: number
  to: number
}

/** „14:30" → 14.5 */
export function toH(t: string | null | undefined, fallback: number): number {
  if (!t) return fallback
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

/** Position einer Stunde im Band als Prozent */
export function pct(h: number): string {
  return `${((Math.min(Math.max(h, BAND_START), BAND_END) - BAND_START) / (BAND_END - BAND_START)) * 100}%`
}

/** Breite eines Abschnitts als Prozent */
export function widthPct(s: Seg): string {
  const a = Math.min(Math.max(s.from, BAND_START), BAND_END)
  const b = Math.min(Math.max(s.to, BAND_START), BAND_END)
  return `${((b - a) / (BAND_END - BAND_START)) * 100}%`
}

function clip(segs: Seg[]): Seg[] {
  return segs.filter((s) => s.to > BAND_START && s.from < BAND_END && s.to > s.from)
}

/**
 * Gold: Valerie ist versorgt, aber nur, wenn das etwas über meinen Tag aussagt.
 * Kita ab 8 bis zum Abholen; holt Oma oder Theresa, bleibt es gold bis 18 Uhr.
 * „Valerie ist weg": ganzer Tag weg = kein Gold (der Strahl bleibt frei für meinen Tag).
 *   Erster Tag: ab der Hinbring-Zeit; letzter Tag: bis zur Abholzeit; ohne Zeit kein Gold (nur der Chip).
 * „Kita zu" mit Oma/Theresa tagsüber: 8–18 Uhr. Eintägige Termine mit Person und Uhrzeit: deren Zeit.
 * Erwartet den Tageszustand NACH applyEffects (entfallene Einträge sind dann schon weg).
 */
export function goldSegments(date: ISODate, day: DayState, occ: Occurrence[], members: Member[]): Seg[] {
  const out: Seg[] = []
  const isParent = (v: string | null | undefined) => !!v && members.some((m) => m.display_name.toLowerCase() === v.toLowerCase())
  const b = day.valerie_bringen
  const h = day.valerie_holen
  if ((b?.value && !b.is_open) || (h?.value && !h.is_open)) {
    const pickup = toH(h?.at, 14)
    out.push({ from: 8, to: pickup })
    if (h?.value && !h.is_open && !isParent(h.value)) out.push({ from: pickup, to: 18 })
  }
  const t = day.valerie_tag
  if (t?.value && !t.is_open && !isParent(t.value) && !/^beide$/i.test(t.value)) out.push({ from: 8, to: 18 })
  for (const o of occ) {
    if (o.occ_date > date || o.occ_end < date) continue
    if (o.effect === 'valerie_weg') {
      const first = o.occ_date === date
      const last = o.occ_end === date
      if (!first && !last) continue
      const from = first ? (o.dropoff_at ? toH(o.dropoff_at, BAND_START) : null) : BAND_START
      const to = last ? (o.pickup_at ? toH(o.pickup_at, BAND_END) : null) : BAND_END
      if (from === null || to === null) continue
      out.push({ from, to })
      continue
    }
    if (o.effect === 'kita_zu' || o.effect === 'eltern_weg') continue
    if (!o.person_id || isMultiDay(o) || !o.start_time) continue
    out.push({ from: toH(o.start_time, 0), to: o.end_time ? toH(o.end_time, 0) : toH(o.start_time, 0) + 1 })
  }
  return clip(out)
}

/** Navy: Termine mit Uhrzeit, die mich oder uns beide betreffen (keine mehrtägigen, keine Betreuungs- oder Wirkungs-Ereignisse) */
export function navySegments(occ: Occurrence[], meId: string | null): Seg[] {
  return clip(
    occ
      .filter((o) => !isMultiDay(o) && !!o.start_time && !o.person_id && (!o.effect || o.effect === 'termin') && (o.member_id === null || o.member_id === meId))
      .map((o) => ({ from: toH(o.start_time, 0), to: o.end_time ? toH(o.end_time, 0) : toH(o.start_time, 0) + 1 })),
  )
}
