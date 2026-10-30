// Sonne, Mond und „Satz des Tages"
import SunCalc from 'suncalc'
import weisheiten from '../content/weisheiten.json'
import woerter from '../content/woerter.json'
import historie from '../content/heute-vor-jahren.json'
import { fromISO, type ISODate } from './dates'

// Standort Chiemsee
export const LAT = 47.85
export const LON = 12.4

const pad = (n: number) => String(n).padStart(2, '0')
const hm = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`

export function sunTimes(date: ISODate): { sunrise: string; sunset: string } {
  const d = fromISO(date)
  d.setHours(12, 0, 0, 0)
  const t = SunCalc.getTimes(d, LAT, LON)
  return { sunrise: hm(t.sunrise), sunset: hm(t.sunset) }
}

export type MoonPhase = 'neumond' | 'zunehmend' | 'vollmond' | 'abnehmend'

export function moonPhase(date: ISODate): { phase: MoonPhase; label: string; fraction: number } {
  const d = fromISO(date)
  d.setHours(12, 0, 0, 0)
  const { phase, fraction } = SunCalc.getMoonIllumination(d)
  let p: MoonPhase
  if (phase < 0.03 || phase > 0.97) p = 'neumond'
  else if (phase < 0.47) p = 'zunehmend'
  else if (phase <= 0.53) p = 'vollmond'
  else p = 'abnehmend'
  const label = { neumond: 'Neumond', zunehmend: 'zunehmend', vollmond: 'Vollmond', abnehmend: 'abnehmend' }[p]
  return { phase: p, label, fraction }
}

// ---------------------------------------------------------------------------

export type DailyKind = 'weisheit' | 'wort' | 'heute'

export interface DailyText {
  label: string
  text: string
  source: string
}

function dayOfYear(date: ISODate): number {
  const d = fromISO(date)
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

/** Deterministisch pro Tag; null, wenn es für den Tag (Historie) nichts gibt. */
export function dailyText(kind: DailyKind, date: ISODate): DailyText | null {
  const n = dayOfYear(date)
  const year = fromISO(date).getFullYear()
  if (kind === 'weisheit') {
    const w = weisheiten[(n * 7 + year) % weisheiten.length]
    return { label: 'Weisheit des Tages', text: `„${w.text}“`, source: w.source }
  }
  if (kind === 'wort') {
    const w = woerter[(n * 11 + year) % woerter.length]
    return { label: 'Wort des Tages', text: `${w.word} – ${w.text}`, source: '' }
  }
  const key = date.slice(5)
  const list = (historie as Record<string, { year: number; text: string }[]>)[key]
  if (!list || list.length === 0) return null
  const e = list[year % list.length]
  const diff = year - e.year
  const when = e.year < 0 ? `${-e.year} v. Chr.` : `${key.slice(3)}.${key.slice(0, 2)}.${e.year}`
  return { label: `Heute vor ${diff} Jahren`, text: e.text, source: when }
}

// Auswahl pro Person und Tag, nur im eigenen Gerät; setzt sich um Mitternacht zurück
const KEY = 'casa.daily'

export interface DailyChoice {
  date: ISODate
  chosen: DailyKind | null
  open: boolean
}

export function readDailyChoice(date: ISODate): DailyChoice {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const c = JSON.parse(raw) as DailyChoice
      if (c.date === date) return c
    }
  } catch {
    /* egal */
  }
  return { date, chosen: null, open: false }
}

export function writeDailyChoice(c: DailyChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* egal */
  }
}
