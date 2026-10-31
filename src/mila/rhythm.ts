// Standard-Rhythmus der Woche, sanfte Vorgabe (Index 0 = Montag)
import type { MilaCategory } from '../lib/types'

export interface Rhythm {
  label: string
  /** Kategorie, aus der Vorschläge kommen; null = keine Vorschläge, Freitext */
  category: MilaCategory | null
  tone: 'navy' | 'gold' | 'grey'
}

export const RHYTHM: Rhythm[] = [
  { label: 'Kochtag', category: 'mealprep', tone: 'navy' },
  { label: 'Aus Prep', category: 'mealprep', tone: 'gold' },
  { label: 'Frisch', category: 'schnell', tone: 'grey' },
  { label: 'Aus Prep', category: 'mealprep', tone: 'gold' },
  { label: 'Frisch', category: 'schnell', tone: 'grey' },
  { label: 'Grill', category: 'grill', tone: 'navy' },
  { label: 'Frei', category: null, tone: 'grey' },
]

export function minutes(min: number | null | undefined): string {
  if (!min) return ''
  if (min >= 120 && min % 60 === 0) return `${min / 60} Std`
  if (min >= 120) return `${Math.floor(min / 60)} Std ${min % 60}`
  return `${min} Min`
}

export function isThermomix(devices: string[]): boolean {
  return devices.includes('thermomix')
}
