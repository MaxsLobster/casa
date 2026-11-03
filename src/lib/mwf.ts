// Munich Watch Fair: Runde, Fälligkeiten aus der Vorlage, Zeitleiste, Messetage als Ereignis
import type { Event, Fair, Member, Settings, Shout, Task, TemplateRow, TemplateSection } from './types'
import { addDays, fromISO, startOfWeek, weekdayShort, type ISODate } from './dates'

export const MWF_NAME = 'Munich Watch Fair'

export const SECTIONS: { value: TemplateSection; label: string }[] = [
  { value: 'start', label: 'Ab Montag nach der letzten Messe' },
  { value: 'until', label: 'Bis zur Messe' },
  { value: 'before', label: 'Tage vorher' },
  { value: 'eve', label: 'Tag davor' },
  { value: 'fair', label: 'Messe' },
]
const SECTION_ORDER: Record<TemplateSection, number> = { start: 0, until: 1, before: 2, eve: 3, fair: 4 }

export function sectionLabel(s: TemplateSection, daysBefore?: number | null): string {
  if (s === 'before') return daysBefore != null ? `${daysBefore} Tage vorher` : 'Vor der Messe'
  return SECTIONS.find((x) => x.value === s)?.label ?? s
}

/** Nächste Messe (heute zählt mit) */
export function nextFair(fairs: Fair[], today: ISODate): Fair | null {
  return [...fairs].filter((f) => f.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

/** Start der Runde: Montag nach der vorigen Messe, sonst Montag sechs Wochen davor */
export function roundStart(fairs: Fair[], fair: Fair): ISODate {
  const prev = fairs.filter((f) => f.date < fair.date).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!prev) return startOfWeek(addDays(fair.date, -42))
  return addDays(startOfWeek(prev.date), 7)
}

/** Fälligkeit einer Vorlagenzeile in der Runde einer Messe */
export function dueFor(row: Pick<TemplateRow, 'days_before'>, fairDate: ISODate, start: ISODate): ISODate {
  if (row.days_before == null) return addDays(start, 4)
  return addDays(fairDate, -row.days_before)
}

export function daysUntil(date: ISODate, today: ISODate): number {
  return Math.round((fromISO(date).getTime() - fromISO(today).getTime()) / 86400000)
}

/** „noch 6 Tage" · „morgen" · „heute" */
export function untilLabel(date: ISODate, today: ISODate): string {
  const d = daysUntil(date, today)
  if (d <= 0) return 'heute'
  if (d === 1) return 'morgen'
  return `noch ${d} Tage`
}

const MON = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
/** „So 8. Nov" */
export function fairLabel(date: ISODate): string {
  const d = fromISO(date)
  return `${weekdayShort(date)} ${d.getDate()}. ${MON[d.getMonth()]}`
}
/** „So 8.11." */
export function dayShort(date: ISODate): string {
  const d = fromISO(date)
  return `${weekdayShort(date)} ${d.getDate()}.${d.getMonth() + 1}.`
}

export function isWorkday(settings: Settings | null, today: ISODate): boolean {
  return !!settings && settings.workday_on === today
}

/** Rundenpunkte einer Messe (aus der Vorlage erzeugt) */
export function roundTasks(tasks: Task[], fairId: string): Task[] {
  return tasks.filter((t) => t.fair_id === fairId)
}

/** Fortschritt der ganzen Runde: laufende Punkte und Altlasten zählen nicht mit */
export function roundProgress(tasks: Task[]): { done: number; total: number } {
  const counted = tasks.filter((t) => !t.is_running && !t.is_skipped)
  return { done: counted.filter((t) => t.status === 'erledigt').length, total: counted.length }
}

/** Wirklich erledigt (keine Altlast) */
export function isDone(t: Pick<Task, 'status' | 'is_skipped'>): boolean {
  return t.status === 'erledigt' && !t.is_skipped
}

/** Gemeinsamer Rundenpunkt („beide"): beide sehen ihn, wer abhakt, erledigt ihn für beide. Kein „übernehmen". */
export function isShared(t: Pick<Task, 'area' | 'owner_member_id' | 'fair_id'>): boolean {
  return t.area === 'mwf' && t.owner_member_id === null && t.fair_id !== null
}

// ---------------------------------------------------------------------------
// Zeitleiste der Checkliste
// ---------------------------------------------------------------------------

export type TimelineRow =
  | { kind: 'phase'; key: string; date: ISODate; dateLabel: string; title: string }
  | { kind: 'item'; key: string; date: ISODate; task: Task | null; preview?: TemplateRow; mine: boolean; who: string; meta: string }
  | { kind: 'today'; key: string; date: ISODate; dateLabel: string; title: string }
  | { kind: 'fair'; key: string; date: ISODate; dateLabel: string }
  | { kind: 'end'; key: string; date: ISODate; title: string }

export interface TimelineInput {
  fair: Fair
  start: ISODate
  tasks: Task[] // Rundenpunkte dieser Messe
  template: TemplateRow[] // nur für die Vorschau einer Runde, die noch nicht begonnen hat
  members: Member[]
  meId: string | null
  today: ISODate
  nextStart: ISODate | null // Montag nach dieser Messe
}

interface Entry {
  section: TemplateSection
  daysBefore: number | null
  date: ISODate
  sort: number
  task: Task | null
  preview?: TemplateRow
  owner: string | null
  running: boolean
}

export function timelineRows(inp: TimelineInput): TimelineRow[] {
  const { fair, start, members, meId, today } = inp
  const byId = new Map(inp.template.map((r) => [r.id, r]))
  const entries: Entry[] = []
  if (inp.tasks.length > 0) {
    for (const t of inp.tasks) {
      const row = t.template_id ? byId.get(t.template_id) : undefined
      const section: TemplateSection = row?.section ?? sectionFromDate(t.due_date, fair.date, start, t.is_running)
      const daysBefore = row ? row.days_before : daysUntil(fair.date, t.due_date)
      // Laufende Punkte stehen am Anfang der Runde (sie gelten ab Start), nicht am Messetag
      entries.push({ section, daysBefore, date: t.is_running ? start : t.due_date, sort: row?.sort ?? 999, task: t, owner: t.owner_member_id, running: t.is_running })
    }
  } else {
    for (const r of inp.template) {
      entries.push({ section: r.section, daysBefore: r.days_before, date: r.is_running ? start : dueFor(r, fair.date, start), sort: r.sort, task: null, preview: r, owner: r.owner_member_id, running: r.is_running })
    }
  }
  entries.sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || (a.section === 'before' ? (b.daysBefore ?? 0) - (a.daysBefore ?? 0) : 0) || a.date.localeCompare(b.date) || a.sort - b.sort)

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? ''
  const rows: TimelineRow[] = []
  let lastPhase = ''
  for (const e of entries) {
    const phaseKey = e.section === 'before' ? `before:${e.daysBefore ?? 0}` : e.section
    if (phaseKey !== lastPhase) {
      lastPhase = phaseKey
      if (e.section === 'fair') {
        rows.push({ kind: 'fair', key: 'fair', date: fair.date, dateLabel: dayShort(fair.date) })
      } else {
        const date = e.section === 'start' || e.section === 'until' ? start : e.date
        rows.push({ kind: 'phase', key: 'ph:' + phaseKey, date, dateLabel: e.section === 'until' ? 'laufend' : dayShort(date), title: sectionLabel(e.section, e.daysBefore) })
      }
    }
    const mine = e.owner === null || e.owner === meId
    const who = e.owner === null ? 'beide' : nameOf(e.owner)
    const metaParts: string[] = []
    if (!mine || e.owner === null) metaParts.push(who)
    if (e.running) metaParts.push('laufend')
    else if (e.section === 'start' && e.daysBefore != null) metaParts.push(`spätestens ${dayShort(e.date)}`)
    rows.push({ kind: 'item', key: e.task ? 't:' + e.task.id : 'p:' + (e.preview?.id ?? e.date), date: e.date, task: e.task, preview: e.preview, mine, who, meta: metaParts.join(' · ') })
  }
  if (!rows.some((r) => r.kind === 'fair')) rows.push({ kind: 'fair', key: 'fair', date: fair.date, dateLabel: dayShort(fair.date) })

  // Heute-Marker: vor der ersten Zeile, die nach heute liegt (nur in der laufenden Runde)
  if (today >= start && today <= fair.date) {
    let idx = rows.findIndex((r) => r.date > today)
    if (idx < 0) idx = rows.length
    rows.splice(idx, 0, { kind: 'today', key: 'today', date: today, dateLabel: dayShort(today).slice(3), title: today === fair.date ? 'Heute · Messe' : `Heute · ${untilLabel(fair.date, today)}` })
  }
  rows.push({ kind: 'end', key: 'end', date: fair.date, title: inp.nextStart ? `Runde abgeschlossen. Ab ${dayShort(inp.nextStart)} startet die nächste.` : 'Runde abgeschlossen.' })
  return rows
}

function sectionFromDate(due: ISODate, fairDate: ISODate, start: ISODate, running: boolean): TemplateSection {
  if (running) return 'until'
  if (due === fairDate) return 'fair'
  if (due === addDays(fairDate, -1)) return 'eve'
  if (due <= addDays(start, 6)) return 'start'
  return 'before'
}

// ---------------------------------------------------------------------------
// Messetage als Ereignis „Messe" in der Casa-Woche (nicht in events gespeichert)
// ---------------------------------------------------------------------------

export const FAIR_EVENT_PREFIX = 'fair:'

export function fairEvents(fairs: Fair[]): Event[] {
  return fairs.map((f) => ({
    id: FAIR_EVENT_PREFIX + f.id,
    household_id: f.household_id,
    title: 'Messe',
    date: f.date,
    end_date: null,
    start_time: null,
    end_time: null,
    member_id: null,
    person_id: null,
    note: f.note,
    repeat: null,
    repeat_until: null,
    effect: 'messe',
    dropoff_by: null,
    dropoff_at: null,
    pickup_by: null,
    pickup_at: null,
    created_by: null,
    updated_by: null,
    created_at: f.created_at,
    updated_at: f.created_at,
  }))
}

export function isFairEvent(e: { id: string }): boolean {
  return e.id.startsWith(FAIR_EVENT_PREFIX)
}

// ---------------------------------------------------------------------------
// Zurufe
// ---------------------------------------------------------------------------

/** Ungelesene Zurufe an mich (nicht archiviert), neueste zuerst */
export function unreadShouts(shouts: Shout[], meId: string | null): Shout[] {
  if (!meId) return []
  return shouts.filter((s) => s.to_member_id === meId && !s.read_at && !s.archived_at).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** „gerade eben" · „vor 5 Min." · „vor 2 Std." · „gestern" · „vor 3 Tagen" · „12.10." */
export function agoLabel(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const h = Math.round(min / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.round(h / 24)
  if (d === 1) return 'gestern'
  if (d < 14) return `vor ${d} Tagen`
  const t = new Date(iso)
  return `${t.getDate()}.${t.getMonth() + 1}.`
}
