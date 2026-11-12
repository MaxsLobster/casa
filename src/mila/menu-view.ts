// Mila · kleine Helfer für die Anzeige der Wochenkarte
import type { MilaMenu, MilaRecipe } from '../lib/types'
import { addDays, startOfWeek, toISO, today, weekdayShort } from '../lib/dates'
import { CATEGORY_LABELS } from './portions'

/** Die Karte für die nächste Woche (immer offen von Montag bis zum Schluss am Sonntagabend) */
export function openMenu(menus: MilaMenu[]): MilaMenu | null {
  const next = addDays(startOfWeek(today()), 7)
  return menus.find((m) => m.week === next) ?? null
}

/** Die Woche, um die es beim Einkaufen und Vorbereiten geht: die nächste, sobald dort etwas eingetragen ist, sonst die laufende */
export function focusWeek(days: { date: string; recipe_id: string | null }[]): string {
  const monday = startOfWeek(today())
  const next = addDays(monday, 7)
  return days.some((d) => d.recipe_id && d.date >= next && d.date <= addDays(next, 6)) ? next : monday
}

/** Kategorie auf der Karte: eigene, sonst die alte */
export function cardLabel(r: Pick<MilaRecipe, 'label' | 'category' | 'devices'>): string {
  if (r.label?.trim()) return r.label.trim()
  if (r.category === 'grill' || r.devices.includes('bge')) return 'Grill / BGE'
  return CATEGORY_LABELS[r.category]
}

/** Ein Satz: eigener, sonst der erste Satz der Notiz */
export function cardBlurb(r: Pick<MilaRecipe, 'blurb' | 'notes'>): string | null {
  if (r.blurb?.trim()) return r.blurb.trim()
  const n = (r.notes ?? '').trim()
  if (!n) return null
  const first = n.split(/(?<=[.!?])\s+|\n/)[0].trim()
  return first.length > 120 ? first.slice(0, 117).trimEnd() + ' …' : first
}

/** „Sa 12 Uhr“ · „Fr 18:30 Uhr“ */
export function deadline(iso: string): string {
  const d = new Date(iso)
  const mm = d.getMinutes()
  return `${weekdayShort(toISO(d))} ${d.getHours()}${mm ? ':' + String(mm).padStart(2, '0') : ''} Uhr`
}
