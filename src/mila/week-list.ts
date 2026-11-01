// Mila · Zutaten einer Woche für die Einkaufsliste einsammeln, dazu die Basics für „Hast du noch?“ (reine Logik, ohne React)
import type { MilaIngredient, MilaRecipe, MilaWeekDay, ShopCategory } from '../lib/types'
import type { NewItem } from './MilaContext'
import { formatAmount } from './shopping'
import { addDays, fromISO, isoWeek, weekdayShort } from '../lib/dates'

/** „2026-W45“; das Jahr ist das ISO-Jahr (über den Donnerstag der Woche) */
export function weekKey(monday: string): string {
  const year = fromISO(addDays(monday, 3)).getFullYear()
  return `${year}-W${String(isoWeek(monday)).padStart(2, '0')}`
}

interface Bucket {
  name: string
  unit: string
  amount: number
  hasAmount: boolean
  category: ShopCategory
  sources: { date: string; recipe: MilaRecipe }[]
}

type Lookup = {
  recipeById: (id: string | null | undefined) => MilaRecipe | null
  ingredientsOf: (recipeId: string) => MilaIngredient[]
}

/**
 * Nimmt die Rezept-Tage der Woche, die noch nicht auf der Liste stehen (added_to_list),
 * lässt Basics weg, fasst gleiche Zutat + Einheit zusammen (Mengen addieren)
 * und hängt die Herkunft an: „Mo · Bolognese“ oder „Mi + Do“.
 */
export function collectWeek(monday: string, days: MilaWeekDay[], recipeById: Lookup['recipeById'], ingredientsOf: Lookup['ingredientsOf']): NewItem[] {
  return collect(monday, days, { recipeById, ingredientsOf }, false)
}

/**
 * „Hast du noch?“: die Basics (Salz, Öl, Gewürze …) aller Rezept-Tage der Woche,
 * gleich zusammengefasst und beschriftet, damit man sie mit einem Tipp doch auf die Liste setzen kann.
 */
export function collectBasics(monday: string, days: MilaWeekDay[], recipeById: Lookup['recipeById'], ingredientsOf: Lookup['ingredientsOf']): NewItem[] {
  return collect(monday, days, { recipeById, ingredientsOf }, true)
}

function collect(monday: string, days: MilaWeekDay[], { recipeById, ingredientsOf }: Lookup, basics: boolean): NewItem[] {
  const wk = weekKey(monday)
  const buckets = new Map<string, Bucket>()
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  for (const d of sorted) {
    if (!d.recipe_id || (!basics && d.added_to_list)) continue
    const recipe = recipeById(d.recipe_id)
    if (!recipe) continue
    for (const i of ingredientsOf(recipe.id)) {
      if (i.pantry_basic !== basics) continue
      const name = i.name.trim()
      if (basics && /^wasser$/i.test(name)) continue
      const unit = (i.unit ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase() + '|' + unit.toLowerCase()
      let b = buckets.get(key)
      if (!b) {
        b = { name, unit, amount: 0, hasAmount: false, category: i.shop_category, sources: [] }
        buckets.set(key, b)
      }
      if (i.amount !== null && i.amount !== undefined) {
        b.amount += Number(i.amount)
        b.hasAmount = true
      }
      if (!b.sources.some((s) => s.date === d.date)) b.sources.push({ date: d.date, recipe })
    }
  }
  return [...buckets.values()].map((b) => ({
    name: b.name,
    amount: formatAmount(b.hasAmount ? b.amount : null, b.unit),
    category: b.category,
    source_label:
      b.sources.length === 1
        ? `${weekdayShort(b.sources[0].date)} · ${b.sources[0].recipe.name}`
        : b.sources.map((s) => weekdayShort(s.date)).join(' + '),
    source_week: wk,
    source_recipe_ids: [...new Set(b.sources.map((s) => s.recipe.id))],
  }))
}

/** Kleine, feste Streuung: gleiche Eingabe, gleiche Zahl (für stabile Vorschläge je Tag) */
export function hashCode(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}
