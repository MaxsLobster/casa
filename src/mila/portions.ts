// Mila · Portionen umrechnen, Beschriftungen für Kategorie und Geräte
import type { MilaCategory, MilaRecipe } from '../lib/types'

export const CATEGORY_LABELS: Record<MilaCategory, string> = {
  schnell: 'Schnell',
  mealprep: 'Meal-Prep',
  wochenende: 'Wochenende',
  grill: 'Grill',
  fruehstueck: 'Frühstück',
}
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as MilaCategory[]

export const DEVICE_LABELS: Record<string, string> = {
  thermomix: 'Thermomix',
  pfanne: 'Pfanne',
  topf: 'Topf',
  wok: 'Wok',
  ofen: 'Ofen',
  plancha: 'Plancha',
  bge: 'Big Green Egg',
  dutch_oven: 'Dutch Oven',
}
export const DEVICES = Object.keys(DEVICE_LABELS)

export type TileKind = 'tm' | 'pan' | 'bowl' | 'grill'

/** Welche Platzhalter-Kachel ein Gericht bekommt */
export function tileKind(r: Pick<MilaRecipe, 'devices' | 'name' | 'category'>): TileKind {
  if (r.devices.includes('thermomix')) return 'tm'
  if (r.devices.includes('bge') || r.category === 'grill') return 'grill'
  if (/bowl|salat|oats|dal|curry|masala|suppe|pho|ramen|kha/i.test(r.name)) return 'bowl'
  if (r.devices.some((d) => d === 'pfanne' || d === 'wok' || d === 'plancha')) return 'pan'
  return 'bowl'
}

/**
 * Menge auf neue Portionen umrechnen und sinnvoll runden:
 * g/ml ab 100 auf 10er, darunter ganz; Stück und Ähnliches auf halbe.
 */
export function scaleAmount(amount: number | null, unit: string, factor: number): number | null {
  if (amount === null || amount === undefined) return null
  const v = Number(amount) * factor
  const u = unit.trim().toLowerCase()
  if (u === 'g' || u === 'ml') return v >= 100 ? Math.round(v / 10) * 10 : Math.round(v) || (v > 0 ? 1 : 0)
  if (u === 'kg' || u === 'l') return Math.round(v * 100) / 100
  const half = Math.round(v * 2) / 2
  return half || (v > 0 ? 0.5 : 0)
}
