// Medikament · Auswertung: Durchschnitte je Medikament und Dosis, Text für die Ärztin. Reine Rechnung, keine Bewertung.
import type { MedCheckin, MedCourse, MedDay, MedPartnerAnswer, MedSettings, MedSlot } from '../lib/types'
import { addDays, fromISO } from '../lib/dates'

export const SLOTS: MedSlot[] = [1, 2, 3]
export const SLOT_LABEL: Record<MedSlot, string> = { 1: 'Vormittag', 2: 'Nachmittag', 3: 'Abend' }
export const SIDE_EFFECTS = ['keine', 'Unruhe', 'Herzklopfen', 'Kopfweh', 'trockener Mund', 'gereizt', 'Sonstiges']

export function slotTime(s: Pick<MedSettings, 't_1' | 't_2' | 't_3'> | null, slot: MedSlot): string {
  const t = s ? (slot === 1 ? s.t_1 : slot === 2 ? s.t_2 : s.t_3) : slot === 1 ? '11:00' : slot === 2 ? '15:00' : '20:00'
  return t.slice(0, 5)
}

export function courseLabel(c: Pick<MedCourse, 'name' | 'dose'> | null): string {
  if (!c || !c.name?.trim()) return 'Kein Medikament'
  return [c.name.trim(), c.dose?.trim()].filter(Boolean).join(' ')
}

/** Welches Medikament galt an dem Tag? (letzter Eintrag mit Start ≤ Tag) */
export function courseOn(courses: MedCourse[], date: string): MedCourse | null {
  let best: MedCourse | null = null
  for (const c of courses) if (c.start_date <= date && (!best || c.start_date >= best.start_date)) best = c
  return best
}

const avg = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const fmt = (n: number | null): string => (n === null ? '–' : (Math.round(n * 10) / 10).toFixed(1).replace('.', ','))

export interface CourseStats {
  course: MedCourse | null
  from: string
  to: string | null
  days: number
  slots: Record<MedSlot, { focus: number | null; calm: number | null; mood: number | null; n: number }>
  sleep: number | null
  appetite: number | null
  partner: number | null
  partnerDays: number
  taken: string | null // mittlere Einnahmezeit
  sideEffects: { name: string; n: number }[]
}

export function courseStats(courses: MedCourse[], days: MedDay[], checkins: MedCheckin[], answers: MedPartnerAnswer[]): CourseStats[] {
  const sorted = [...courses].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.created_at.localeCompare(b.created_at))
  return sorted
    .map((c, i) => {
      const to = sorted[i + 1] ? addDays(sorted[i + 1].start_date, -1) : null
      const inRange = (d: string) => d >= c.start_date && (!to || d <= to)
      const ds = days.filter((d) => inRange(d.date))
      const cs = checkins.filter((k) => inRange(k.date))
      const as = answers.filter((a) => inRange(a.date))
      const dates = new Set([...ds.filter((d) => d.taken_at || d.sleep).map((d) => d.date), ...cs.map((k) => k.date)])
      const slot = (s: MedSlot) => {
        const rows = cs.filter((k) => k.slot === s)
        return { focus: avg(rows.map((r) => r.focus)), calm: avg(rows.map((r) => r.calm)), mood: avg(rows.map((r) => r.mood)), n: rows.length }
      }
      const mins = ds.filter((d) => d.taken_at).map((d) => Number(d.taken_at!.slice(0, 2)) * 60 + Number(d.taken_at!.slice(3, 5)))
      const m = avg(mins)
      const fx = new Map<string, number>()
      for (const k of cs) for (const e of k.side_effects ?? []) if (e !== 'keine') fx.set(e, (fx.get(e) ?? 0) + 1)
      return {
        course: c,
        from: c.start_date,
        to,
        days: dates.size,
        slots: { 1: slot(1), 2: slot(2), 3: slot(3) },
        sleep: avg(ds.map((d) => d.sleep)),
        appetite: avg(cs.map((k) => k.appetite)),
        partner: avg(as.map((a) => a.value)),
        partnerDays: as.length,
        taken: m === null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`,
        sideEffects: [...fx.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
      }
    })
    .reverse()
}

const de = (d: string) => `${fromISO(d).getDate()}.${fromISO(d).getMonth() + 1}.${fromISO(d).getFullYear()}`

/** Text zum Kopieren: Durchschnitte je Medikament, dann die Notizen */
export function exportText(stats: CourseStats[], checkins: MedCheckin[], answers: MedPartnerAnswer[], partnerName: string): string {
  const out: string[] = ['Verlauf Medikament (eigene Werte, Skala 1–5, 5 = am besten bzw. am meisten)', '']
  for (const s of stats) {
    out.push(`${courseLabel(s.course)} · ${de(s.from)} bis ${s.to ? de(s.to) : 'heute'} · ${s.days} ${s.days === 1 ? 'Tag' : 'Tage'} mit Einträgen`)
    if (s.taken) out.push(`Einnahme im Schnitt um ${s.taken} Uhr`)
    for (const k of SLOTS) {
      const x = s.slots[k]
      if (x.n) out.push(`${SLOT_LABEL[k]} (${x.n}×): Fokus ${fmt(x.focus)} · Ruhe im Kopf ${fmt(x.calm)} · Stimmung ${fmt(x.mood)}`)
    }
    out.push(`Schlaf ${fmt(s.sleep)} · Appetit ${fmt(s.appetite)}` + (s.partnerDays ? ` · Abend aus Sicht von ${partnerName} ${fmt(s.partner)} (${s.partnerDays}×, 1 = angespannt, 5 = entspannt)` : ''))
    if (s.sideEffects.length) out.push('Nebenwirkungen: ' + s.sideEffects.map((e) => `${e.name} ${e.n}×`).join(', '))
    const notes = [
      ...checkins.filter((c) => c.note?.trim() && c.date >= s.from && (!s.to || c.date <= s.to)).map((c) => ({ d: c.date, t: `${SLOT_LABEL[c.slot]}: ${c.note!.trim()}` })),
      ...answers.filter((a) => a.note?.trim() && a.date >= s.from && (!s.to || a.date <= s.to)).map((a) => ({ d: a.date, t: `${partnerName}: ${a.note!.trim()}` })),
    ].sort((a, b) => a.d.localeCompare(b.d))
    if (notes.length) {
      out.push('Notizen:')
      for (const n of notes) out.push(`  ${de(n.d)} · ${n.t}`)
    }
    out.push('')
  }
  return out.join('\n').trim()
}
