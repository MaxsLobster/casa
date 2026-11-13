// Mila · Rechnen für die Rezeptkarte (ohne Oberfläche): Mengen umrechnen, Varianten anwenden, Farbpunkte, „zuletzt gekocht“
import type { MilaIngredient, MilaRecipe, MilaVariantKey, MilaWeekDay } from '../lib/types'
import { fromISO } from '../lib/dates'
import { categorize } from './shopping'

export const PORTION_CHOICES = [2, 3, 4, 5, 6]
const PORTION_KEY = 'mila.portionen'

/** Zuletzt gewählte Portionszahl auf diesem Gerät, sonst 3 */
export function lastPortions(): number {
  try {
    const n = Number(localStorage.getItem(PORTION_KEY))
    return PORTION_CHOICES.includes(n) ? n : 3
  } catch {
    return 3
  }
}
export function rememberPortions(n: number) {
  try {
    localStorage.setItem(PORTION_KEY, String(n))
  } catch {
    /* privat-Modus */
  }
}

/** Halbe mit „½“: 1.5 → „1½“, 0.5 → „½“ */
export function half(x: number): string {
  let w = Math.floor(x)
  const r = x - w
  let h = ''
  if (r >= 0.25 && r < 0.75) h = '½'
  else if (r >= 0.75) w += 1
  return (w > 0 ? String(w) : '') + h || '½'
}

/**
 * Menge für neue Portionen, gerundet wie im Mila-Detail:
 * g/ml unter 100 ganzzahlig, ab 100 auf 10er; Stück, EL, TL und alles andere auf halbe.
 */
export function qty(amount: number | null, unit: string | null, factor: number): string {
  const u = (unit ?? '').trim()
  if (amount === null || amount === undefined) return ''
  const v = Number(amount) * factor
  const lu = u.toLowerCase()
  if (lu === 'g' || lu === 'ml') return `${v >= 100 ? Math.round(v / 10) * 10 : Math.max(1, Math.round(v))} ${u}`
  if (lu === 'kg' || lu === 'l') return `${String(Math.round(v * 100) / 100).replace('.', ',')} ${u}`
  return u ? `${half(v)} ${u}` : half(v)
}

/** Mahlzeit-Pill vorne auf dem Foto */
export function mealPill(r: MilaRecipe): string {
  return r.meal === 'mittag' ? 'Mittagskarte' : r.meal === 'beides' ? 'Mittag & Abend' : 'Abendkarte'
}

const DIET = ['Vegan', 'Vegetarisch']
/** „Vegan · Indisch · aus HelloFresh“ */
export function kicker(r: MilaRecipe): string {
  const diet = (r.tags ?? []).find((t) => DIET.includes(t))
  return [diet, (r.cuisine ?? [])[0], r.hf_id ? 'aus HelloFresh' : 'eigenes Rezept'].filter(Boolean).join(' · ')
}

export const DIFFICULTY: Record<string, string> = { leicht: 'Leicht', mittel: 'Mittel', aufwendig: 'Aufwendig' }

// ---------------------------------------------------------------------------
// Varianten (Light / Protein): Tausch-Texte sind frei formuliert, daher über Stichworte zuordnen
// ---------------------------------------------------------------------------

export interface CardIngredient {
  key: string
  name: string
  amount: string
  ing: MilaIngredient | null
  /** getauscht oder neu durch die Variante (Gold-Punkt) */
  swapped: boolean
  added: boolean
  /** kurzer Zusatz: „→ Kokosmilch light“, „optional“, „statt Paprika“ */
  note: string | null
  optional: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/\d+([.,]\d+)?\s*(g|ml|el|tl|stück)?\b/g, '').replace(/\s+/g, ' ').trim()

/** Zu welcher Zutat gehört „statt …“? Längster passender Name gewinnt; erstes Wort als Rückfall (Hackfleisch → Rinderhack) */
export function matchIngredient(statt: string, ings: MilaIngredient[]): MilaIngredient | null {
  const s = norm(statt)
  if (!s || s === '–' || s === '-') return null
  let best: MilaIngredient | null = null
  let bestLen = 0
  for (const i of ings) {
    const n = norm(i.name)
    if (!n) continue
    if ((s.includes(n) || n.includes(s)) && n.length > bestLen) {
      best = i
      bestLen = n.length
    }
  }
  if (best) return best
  const stem = s.split(' ')[0].replace(/fleisch$/, '')
  if (stem.length >= 3) return ings.find((i) => norm(i.name).includes(stem)) ?? null
  return null
}

export const isAddition = (statt: string) => /^\s*[–-]?\s*$/.test(statt)

export function variantOf(r: MilaRecipe, v: MilaVariantKey) {
  if (v === 'original') return null
  return r.variants?.[v] ?? null
}

/** Zutatenliste der Karte (ohne „Hast du da“) für Portionen und Variante */
export function cardIngredients(r: MilaRecipe, ings: MilaIngredient[], portions: number, v: MilaVariantKey): CardIngredient[] {
  const factor = portions / Math.max(1, r.portions)
  const optional = new Set((r.optional_items ?? []).map((x) => norm(x)))
  const isOptional = (i: MilaIngredient) => optional.has(norm(i.name)) || (!!i.hf_original && optional.has(norm(i.hf_original)))
  const list: CardIngredient[] = ings
    .filter((i) => !i.pantry_basic)
    .map((i) => ({
      key: i.id,
      name: i.name,
      amount: qty(i.amount, i.unit, factor),
      ing: i,
      swapped: false,
      added: false,
      note: i.anna_swap && i.hf_original ? `statt ${i.hf_original.replace(/\s+\d.*$/, '')}` : null,
      optional: isOptional(i),
    }))
  const variant = variantOf(r, v)
  if (variant) {
    variant.tausch.forEach((t, k) => {
      if (isAddition(t.statt)) {
        list.push({ key: 'neu-' + k, name: t.nimm, amount: '', ing: null, swapped: true, added: true, note: 'neu', optional: false })
        return
      }
      const hit = matchIngredient(t.statt, ings)
      const row = hit ? list.find((x) => x.ing?.id === hit.id) : null
      if (row) {
        row.swapped = true
        row.note = 'getauscht'
      }
    })
  }
  return list
}

/** „Salz, Pfeffer, 1½ EL Öl, 1 TL Zucker“ */
export function pantryLine(r: MilaRecipe, ings: MilaIngredient[], portions: number): string {
  const factor = portions / Math.max(1, r.portions)
  return ings
    .filter((i) => i.pantry_basic && !/^wasser$/i.test(i.name.trim()))
    .map((i) => {
      const a = qty(i.amount, i.unit, factor)
      return a ? `${a} ${i.name}` : i.name
    })
    .join(', ')
}

/** kcal und Protein der gewählten Variante; geschätzte Werte mit „≈“ */
export function stats(r: MilaRecipe, v: MilaVariantKey): { kcal: string; protein: string } {
  const n = r.nutrition
  const variant = variantOf(r, v)
  if (variant) {
    return {
      kcal: variant.kcal_geschaetzt != null ? `≈${variant.kcal_geschaetzt}` : '–',
      protein: variant.protein_g_geschaetzt != null ? `≈${Math.round(variant.protein_g_geschaetzt)} g` : '–',
    }
  }
  return { kcal: n?.kcal != null ? String(Math.round(n.kcal)) : '–', protein: n?.protein_g != null ? `${Math.round(n.protein_g)} g` : '–' }
}

// ---------------------------------------------------------------------------
// Einkaufszettel mit Variante: Zutaten umbenennen bzw. ergänzen (für shoppingFor)
// ---------------------------------------------------------------------------

/** Zutaten eines Gerichts so, wie sie mit der Variante eingekauft werden */
export function variantShopping(r: MilaRecipe, ings: MilaIngredient[], v: MilaVariantKey): MilaIngredient[] {
  const variant = variantOf(r, v)
  if (!variant) return ings
  const out = ings.map((i) => ({ ...i }))
  variant.tausch.forEach((t, k) => {
    if (isAddition(t.statt)) {
      out.push({ ...ings[0], id: `${r.id}-v${k}`, name: t.nimm, amount: null, unit: '', pantry_basic: false, shop_category: categorize(t.nimm), hint: null, blend_key: null, hf_original: null, anna_swap: false })
      return
    }
    const hit = matchIngredient(t.statt, ings)
    const row = hit ? out.find((x) => x.id === hit.id) : null
    if (row) row.name = `${row.name} (${v === 'light' ? 'Light' : 'Protein'}: ${t.nimm})`
  })
  return out
}

// ---------------------------------------------------------------------------
// Farbpunkte je Zutat (einfache Stichwort-Palette)
// ---------------------------------------------------------------------------

const PALETTE: [RegExp, string, string][] = [
  [/süßkartoffel|karotte|möhre|kürbis|orange|aprikose|mango/, '#E39A3B', '#B87425'],
  [/tomate|chili|paprika|radieschen|rote bete|erdbeer|granatapfel/, '#D24B2A', '#A33A20'],
  [/zwiebel|knoblauch|ingwer|schalotte/, '#E9D9B8', '#BFA97E'],
  [/spinat|salat|petersilie|koriander|basilikum|schnittlauch|lauch|frühlingszwiebel|zucchini|brokkoli|pak choi|gurke|erbse|bohne grün|kräuter|minze|dill|avocado|limette|edamame/, '#5E8F3A', '#43692A'],
  [/kokosmilch|joghurt|sahne|milch|mozzarella|feta|frischkäse|quark|skyr|reis|tofu|blumenkohl|mehl|stärke|crème|schmand/, '#F6F2E6', '#CFC6AE'],
  [/käse|parmesan|butter|mais|zitrone|ei\b|eier|nudel|pasta|spaghetti|gnocchi|bulgur|couscous|brot|pita|tortilla|wrap|dinkel/, '#EBCB7A', '#BE9C4C'],
  [/hausmischung|gewürz|curry|paprikapulver|kreuzkümmel|zimt|paste|soße|sauce|brühe|fond/, '#B9692F', '#8A4C20'],
  [/hack|rind|steak|lamm|schwein|chorizo|speck|wurst/, '#9A4B3A', '#6E3126'],
  [/hähnch|huhn|pute|garnele|lachs|fisch|kabeljau/, '#E8B49A', '#B8806A'],
  [/bohne|linse|kichererbse|pilz|champignon|aubergine|olive/, '#6B5440', '#46362A'],
]
const BY_AISLE: Record<string, [string, string]> = {
  obst_gemuese: ['#8DB36A', '#5E8F3A'],
  kuehl: ['#F1EBD9', '#C9BFA6'],
  fleisch_fisch: ['#C97A6A', '#9A4B3A'],
  trocken: ['#D8C7A0', '#AE9C74'],
}
export function dotColor(name: string, aisle?: string): [string, string] {
  const n = name.toLowerCase()
  for (const [re, a, b] of PALETTE) if (re.test(n)) return [a, b]
  return BY_AISLE[aisle ?? ''] ?? ['#D8C7A0', '#AE9C74']
}

// ---------------------------------------------------------------------------
// „zuletzt gekocht“
// ---------------------------------------------------------------------------

export function lastCookedLabel(recipeId: string, weekDays: MilaWeekDay[], today: string): string {
  let last: string | null = null
  for (const w of weekDays) if (w.recipe_id === recipeId && !w.is_leftover && w.date < today && (!last || w.date > last)) last = w.date
  if (!last) return 'noch nie gekocht'
  const days = Math.round((fromISO(today).getTime() - fromISO(last).getTime()) / 86400000)
  if (days <= 1) return 'zuletzt gekocht gestern'
  if (days < 7) return `zuletzt gekocht vor ${days} Tagen`
  const w = Math.round(days / 7)
  if (w < 9) return w === 1 ? 'zuletzt gekocht vor einer Woche' : `zuletzt gekocht vor ${w} Wochen`
  const m = Math.round(days / 30)
  return m <= 1 ? 'zuletzt gekocht vor einem Monat' : `zuletzt gekocht vor ${m} Monaten`
}
