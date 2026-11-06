// Mila · kleine Helfer für die Anzeige der Wochenkarte
import type { MilaMenu, MilaRecipe } from '../lib/types'
import { startOfWeek, toISO, today, weekdayShort } from '../lib/dates'
import { CATEGORY_LABELS } from './portions'

/** Die Karte, um die es gerade geht: neueste, noch nicht übernommene ab dieser Woche */
export function openMenu(menus: MilaMenu[]): MilaMenu | null {
  const monday = startOfWeek(today())
  return [...menus].sort((a, b) => b.week.localeCompare(a.week)).find((m) => !m.adopted_at && m.week >= monday) ?? null
}

/** Neueste übernommene Woche ab dieser Woche (für Prep und Einkauf), sonst die zuletzt übernommene */
export function adoptedMenu(menus: MilaMenu[]): MilaMenu | null {
  const sorted = [...menus].filter((m) => m.adopted_at).sort((a, b) => b.week.localeCompare(a.week))
  return sorted[0] ?? null
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
