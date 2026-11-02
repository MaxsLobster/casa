// Anker: Helfer für Phasen, Gruppen („In Bewegung · Ruht · Läuft") und Datumsangaben.
// Der nächste Schritt eines Ankers ist eine Aufgabe (tasks.anchor_id + is_step).

import type { Anchor, AnchorPhase, Task } from './types'
import { addDays, fromISO, shortDate, startOfWeek, toISO, weekdayShort, type ISODate } from './dates'

export const PHASES: { value: AnchorPhase; label: string }[] = [
  { value: 'idee', label: 'Idee' },
  { value: 'klaeren', label: 'Klären' },
  { value: 'testen', label: 'Testen' },
  { value: 'entscheiden', label: 'Entscheiden' },
  { value: 'laeuft', label: 'Läuft' },
]

export function phaseLabel(p: AnchorPhase): string {
  return PHASES.find((x) => x.value === p)?.label ?? p
}
export function phaseIndex(p: AnchorPhase): number {
  return Math.max(0, PHASES.findIndex((x) => x.value === p))
}

/** Ruht = letzte Bewegung älter als 21 Tage und Phase nicht „Läuft" */
export const REST_DAYS = 21

export function isResting(a: Anchor, now: Date = new Date()): boolean {
  if (a.phase === 'laeuft') return false
  return now.getTime() - new Date(a.moved_at).getTime() > REST_DAYS * 86400000
}

export type AnchorGroup = 'bewegung' | 'ruht' | 'laeuft'
export const GROUP_TITLE: Record<AnchorGroup, string> = { bewegung: 'In Bewegung', ruht: 'Ruht', laeuft: 'Läuft' }

export function groupOf(a: Anchor, now: Date = new Date()): AnchorGroup {
  if (a.phase === 'laeuft') return 'laeuft'
  return isResting(a, now) ? 'ruht' : 'bewegung'
}

/** Der offene nächste Schritt eines Ankers */
export function stepOf(anchorId: string, tasks: Task[]): Task | null {
  return tasks.find((t) => t.anchor_id === anchorId && t.is_step && t.status !== 'erledigt') ?? null
}

/** „bewegt heute" · „bewegt gestern" · „bewegt vor 3 Tagen" · „bewegt vor 2 Wochen" · „bewegt vor 3 Monaten" */
export function movedLabel(movedAt: string, today: ISODate): string {
  const d = toISO(new Date(movedAt))
  const days = Math.round((fromISO(today).getTime() - fromISO(d).getTime()) / 86400000)
  if (days <= 0) return 'bewegt heute'
  if (days === 1) return 'bewegt gestern'
  if (days < 7) return `bewegt vor ${days} Tagen`
  const weeks = Math.round(days / 7)
  if (days < 60) return weeks === 1 ? 'bewegt vor 1 Woche' : `bewegt vor ${weeks} Wochen`
  const months = Math.round(days / 30)
  return months === 1 ? 'bewegt vor 1 Monat' : `bewegt vor ${months} Monaten`
}

/** Datum im Verlauf: heute · gestern · Mo (diese Woche) · 20.09. */
export function logDate(at: string, today: ISODate): string {
  const d = toISO(new Date(at))
  if (d === today) return 'heute'
  if (d === addDays(today, -1)) return 'gestern'
  if (d >= startOfWeek(today) && d < today) return weekdayShort(d)
  return shortDate(d)
}

/** „Max · bis Fr" für einen Schritt */
export function stepMeta(t: Task, members: { id: string; display_name: string }[], today: ISODate): string {
  const who = t.owner_member_id ? (members.find((m) => m.id === t.owner_member_id)?.display_name ?? '') : 'offen'
  return `${who} · ${dueLabel(t.due_date, today)}`
}

/** „bis Fr" (diese Woche) · „bis 15.11." · „heute" · „seit Mo" */
export function dueLabel(due: ISODate, today: ISODate): string {
  if (due === today) return 'heute'
  if (due === addDays(today, 1)) return 'morgen'
  const sunday = addDays(startOfWeek(today), 6)
  if (due < today) return due >= startOfWeek(today) ? `seit ${weekdayShort(due)}` : `seit ${shortDate(due)}`
  if (due <= sunday) return `bis ${weekdayShort(due)}`
  return `bis ${shortDate(due)}`
}
