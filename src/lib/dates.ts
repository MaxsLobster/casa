// Kleine Datumshelfer, alles in lokaler Zeit, Format YYYY-MM-DD.

export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 1 = Montag … 7 = Sonntag */
export function weekday(s: ISODate): number {
  const js = fromISO(s).getDay()
  return js === 0 ? 7 : js
}

/** Montag der Woche, in der das Datum liegt */
export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, 1 - weekday(s))
}

export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** ISO-Kalenderwoche */
export function isoWeek(s: ISODate): number {
  const d = fromISO(s)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export function weekdayLong(s: ISODate): string {
  return WD_LONG[weekday(s) - 1]
}
export function weekdayShort(s: ISODate): string {
  return WD_SHORT[weekday(s) - 1]
}
export function weekdayShortByIndex(wd: number): string {
  return WD_SHORT[wd - 1]
}
export function weekdayLongByIndex(wd: number): string {
  return WD_LONG[wd - 1]
}

/** „Montag, 19. Oktober" */
export function headline(s: ISODate): string {
  const d = fromISO(s)
  return `${weekdayLong(s)}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`
}

/** „19.10." */
export function shortDate(s: ISODate): string {
  const d = fromISO(s)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

/** „19. – 25. Oktober" bzw. „28. Oktober – 3. November" */
export function weekRange(monday: ISODate): string {
  const a = fromISO(monday)
  const b = fromISO(addDays(monday, 6))
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}. – ${b.getDate()}. ${MONTHS[a.getMonth()]}`
  return `${a.getDate()}. ${MONTHS[a.getMonth()]} – ${b.getDate()}. ${MONTHS[b.getMonth()]}`
}

/**
 * Kurze, freundliche Angabe relativ zu heute:
 * heute · morgen · Fr (diese Woche) · 15.10. (sonst) · „seit Mo" wenn vorbei
 */
export function relativeLabel(s: ISODate, ref: ISODate = today()): string {
  if (s === ref) return 'heute'
  if (s === addDays(ref, 1)) return 'morgen'
  const monday = startOfWeek(ref)
  const sunday = addDays(monday, 6)
  if (s < ref) {
    return s >= monday ? `seit ${weekdayShort(s)}` : `seit ${shortDate(s)}`
  }
  if (s <= sunday) return `bis ${weekdayShort(s)}`
  return `bis ${shortDate(s)}`
}

/** Für den Stempel: „Fr" (diese Woche) oder „15.10." */
export function stampDate(s: ISODate, ref: ISODate = today()): string {
  if (s === ref) return 'Heute'
  if (s === addDays(ref, 1)) return 'Morgen'
  const monday = startOfWeek(ref)
  const sunday = addDays(monday, 6)
  if (s >= monday && s <= sunday) return weekdayShort(s)
  return shortDate(s)
}

/** „14:00" aus „14:00:00" */
export function hhmm(t: string | null | undefined): string {
  if (!t) return ''
  return t.slice(0, 5)
}

/** „14 Uhr" bzw. „14:30 Uhr" */
export function uhr(t: string | null | undefined): string {
  const v = hhmm(t)
  if (!v) return ''
  const [h, m] = v.split(':')
  return m === '00' ? `${Number(h)} Uhr` : `${Number(h)}:${m} Uhr`
}

/** Nächster Freitag (heute, falls heute Freitag ist und noch nicht vorbei) */
export function nextWeekdayOnOrAfter(wd: number, ref: ISODate = today()): ISODate {
  const diff = (wd - weekday(ref) + 7) % 7
  return addDays(ref, diff)
}
