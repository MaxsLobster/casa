// Freizeit · Rechnen ohne Oberfläche: Datum und Uhrzeit in Berlin, welches Wochenende, welcher Termin für die Woche
import type { Event, FreizeitRadar, FreizeitTipp } from './types'
import { addDays, fromISO, weekdayShort } from './dates'

const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })

/** ISO-Zeitpunkt → Tag und Uhrzeit in Berlin */
export function berlin(iso: string): { date: string; time: string } {
  const p = Object.fromEntries(FMT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

const dm = (d: string) => `${fromISO(d).getDate()}.${fromISO(d).getMonth() + 1}.`
const day = (d: string) => `${weekdayShort(d)} ${dm(d)}`
/** „15“ statt „15:00“, „21:30“ bleibt */
const clock = (t: string) => (t.endsWith(':00') ? String(Number(t.slice(0, 2))) : `${Number(t.slice(0, 2))}:${t.slice(3, 5)}`)

/** „Sa 14.11. · 15–16 Uhr“ · „Sa 21.11. – Sa 12.12.“ · „“ wenn nichts bekannt */
export function whenLabel(t: Pick<FreizeitTipp, 'start' | 'ende' | 'ganztags'>): string {
  if (!t.start) return ''
  const a = berlin(t.start)
  const b = t.ende ? berlin(t.ende) : null
  const multi = !!b && b.date !== a.date
  const days = multi ? `${day(a.date)} – ${day(b!.date)}` : day(a.date)
  if (t.ganztags) return days
  const times = b && b.time !== a.time ? `${clock(a.time)}–${clock(b.time)} Uhr` : `${clock(a.time)} Uhr`
  return `${days} · ${times}`
}

/** „14./15. November“ */
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export function weekendLabel(saturday: string): { days: string; month: string } {
  const a = fromISO(saturday)
  const b = fromISO(addDays(saturday, 1))
  if (a.getMonth() === b.getMonth()) return { days: `${a.getDate()}./${b.getDate()}.`, month: MONTHS[a.getMonth()] }
  return { days: `${a.getDate()}.${a.getMonth() + 1}./${b.getDate()}.${b.getMonth() + 1}.`, month: '' }
}

/** Das Wochenende, um das es gerade geht: das nächste (bis einschließlich Sonntag), sonst das letzte */
export function currentRadar(radars: FreizeitRadar[], today: string): FreizeitRadar | null {
  const sorted = [...radars].sort((a, b) => a.wochenende.localeCompare(b.wochenende))
  return sorted.find((r) => addDays(r.wochenende, 1) >= today) ?? sorted[sorted.length - 1] ?? null
}

/** Tag, an dem der Tipp stattfindet (für Sortierung und „vorbei?“) */
export function tippDay(t: FreizeitTipp): string | null {
  return t.start_tag ?? (t.start ? berlin(t.start).date : null)
}

/** Letzter Tag des Tipps (Ende, sonst Start); null = ohne Datum */
export function tippEndDay(t: FreizeitTipp): string | null {
  return t.ende ? berlin(t.ende).date : tippDay(t)
}

/** Vorbei? Nur mit Datum; Tipps ohne Datum bleiben sichtbar */
export function tippPast(t: FreizeitTipp, today: string): boolean {
  const end = tippEndDay(t)
  return !!end && end < today
}

/** Alarm noch zeigen? Bis die Frist vorbei ist oder jemand reagiert hat. Ohne Frist: bis zum Tag des Termins, sonst 14 Tage. */
export function alarmOpen(t: FreizeitTipp, today: string): boolean {
  if (t.typ !== 'alarm' || t.status !== 'neu') return false
  if (t.frist) return t.frist >= today
  const d = tippDay(t)
  if (d) return d >= today
  return addDays(berlin(t.erstellt_am).date, 14) >= today
}

/** Termin für die Casa-Woche: Datum und Uhrzeit des Tipps, ganztägig ohne Uhrzeit; null, wenn kein Datum bekannt ist */
export function tippEvent(t: FreizeitTipp, radar: FreizeitRadar | null): Pick<Event, 'title' | 'date' | 'end_date' | 'start_time' | 'end_time' | 'note'> | null {
  const a = t.start ? berlin(t.start) : null
  const date = a?.date ?? radar?.wochenende ?? null
  if (!date) return null
  const b = t.ende ? berlin(t.ende) : null
  // mehrtägig nur für ein Wochenende (bis 3 Tage); lange Märkte stehen am ersten Tag
  const span = b && a && b.date > a.date && b.date <= addDays(a.date, 3)
  const timed = !!a && !t.ganztags && !span
  return {
    title: t.titel,
    date,
    end_date: span ? b!.date : null,
    start_time: timed ? a!.time : null,
    end_time: timed && b && b.date === a!.date && b.time > a!.time ? b.time : null,
    note: [t.ort, t.link].filter(Boolean).join(' · ') || null,
  }
}
