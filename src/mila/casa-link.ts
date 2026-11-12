// Mila in Casa: Prep-Stunde als abgeleiteter Termin (nicht in events gespeichert, wie die Messetage)
import type { Event, MilaWeekDay } from '../lib/types'
import { addDays, startOfWeek } from '../lib/dates'
import type { Rhythm } from './engine'

export const MILA_EVENT_PREFIX = 'mila:'

export function isMilaEvent(e: { id: string }): boolean {
  return e.id.startsWith(MILA_EVENT_PREFIX)
}

/** Termin „Prep-Stunde“ für beide, nur vor Wochen, in denen Mo–Fr Gerichte eingetragen sind */
export function prepEvents(householdId: string, r: Pick<Rhythm, 'prep_weekday' | 'prep_time'>, days: MilaWeekDay[]): Event[] {
  const weeks = new Set<string>()
  for (const d of days) {
    if (!d.recipe_id) continue
    const monday = startOfWeek(d.date)
    if (d.date <= addDays(monday, 4)) weeks.add(monday)
  }
  const end = String(Number(r.prep_time.slice(0, 2)) + 1).padStart(2, '0') + r.prep_time.slice(2, 5)
  return [...weeks].map((monday) => ({
    id: MILA_EVENT_PREFIX + 'prep:' + monday,
    household_id: householdId,
    title: 'Prep-Stunde',
    date: addDays(monday, -7 + r.prep_weekday - 1),
    end_date: null,
    start_time: r.prep_time.slice(0, 5),
    end_time: end,
    member_id: null,
    person_id: null,
    note: null,
    repeat: null,
    repeat_until: null,
    effect: 'termin' as const,
    dropoff_by: null,
    dropoff_at: null,
    pickup_by: null,
    pickup_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  }))
}

/** Mahlzeiten eines Tages aus der Mila-Woche */
export function mealsOn(days: MilaWeekDay[], date: string): { mittag: MilaWeekDay | null; abend: MilaWeekDay | null } {
  const of = (meal: 'mittag' | 'abend') => days.find((d) => d.date === date && (d.meal ?? 'abend') === meal && d.recipe_id) ?? null
  return { mittag: of('mittag'), abend: of('abend') }
}
