// Wiederholungen von Terminen/Ereignissen in einem Zeitfenster ausrollen
import type { Event } from './types'
import { addDays, fromISO, toISO, type ISODate } from './dates'

/** Ein konkretes Vorkommen eines Termins (bei Wiederholung mit verschobenem Datum) */
export interface Occurrence extends Event {
  occ_date: ISODate
  occ_end: ISODate
  base_id: string
  is_repeat: boolean
}

function shift(date: ISODate, repeat: NonNullable<Event['repeat']>, n: number): ISODate {
  const d = fromISO(date)
  if (repeat === 'weekly') d.setDate(d.getDate() + 7 * n)
  if (repeat === 'monthly') {
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + n)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, last))
  }
  if (repeat === 'yearly') {
    const m = d.getMonth()
    const day = d.getDate()
    d.setFullYear(d.getFullYear() + n, m, 1)
    const last = new Date(d.getFullYear(), m + 1, 0).getDate()
    d.setDate(Math.min(day, last))
  }
  return toISO(d)
}

/** Alle Vorkommen, die den Zeitraum [from, to] berühren */
export function occurrences(events: Event[], from: ISODate, to: ISODate): Occurrence[] {
  const out: Occurrence[] = []
  for (const e of events) {
    const span = e.end_date && e.end_date > e.date ? (fromISO(e.end_date).getTime() - fromISO(e.date).getTime()) / 86400000 : 0
    const push = (start: ISODate, isRepeat: boolean) => {
      const end = span ? addDays(start, Math.round(span)) : start
      if (end < from || start > to) return
      out.push({ ...e, occ_date: start, occ_end: end, base_id: e.id, is_repeat: isRepeat })
    }
    if (!e.repeat) {
      push(e.date, false)
      continue
    }
    // Ab dem ersten Datum ausrollen, bis hinter das Fenster oder repeat_until
    let n = 0
    while (n < 400) {
      const start = shift(e.date, e.repeat, n)
      if (start > to) break
      if (e.repeat_until && start > e.repeat_until) break
      push(start, n > 0)
      n++
    }
  }
  return out.sort((a, b) => a.occ_date.localeCompare(b.occ_date) || (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
}

export function isMultiDay(o: Occurrence): boolean {
  return o.occ_end > o.occ_date
}
