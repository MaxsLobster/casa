// Mila · Wochenwahl: Stapel, Kombo als Kochreihenfolge, Fristen, „Heute dran“ und Kühlschrank-Ampel.
// Reine Rechnung ohne React; läuft in der App und gebündelt in der Edge Function „mila-tick“.
import type { MealSlot, MilaDeckCard, MilaIngredient, MilaItemArt, MilaItemGroup, MilaPlanItem, MilaRecipe, MilaShelfRule, MilaStep, MilaPrepStep, MilaWeekDay, MilaWeekPlan } from '../lib/types'
import { addDays, fromISO } from '../lib/dates'
import type { Rhythm } from './engine'

type ISODate = string
const DAY = 86400000
export const ABEND_PORTIONEN = 3
export const MITTAG_PORTIONEN = 2
export const RESTE_PORTIONEN = 2
export const JOKER_PRO_WOCHE = 2
export const SWIPE_PX = 110

export const daysBetween = (a: ISODate, b: ISODate) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / DAY)

// ---------------------------------------------------------------------------
// Zeiten: Wahl öffnet Freitag, Frist Sonntag 20 Uhr, Einkauf und Prep in der Woche selbst
// ---------------------------------------------------------------------------

export function planTimes(week: ISODate, r: Pick<Rhythm, 'card_weekday' | 'card_time' | 'close_weekday' | 'close_time' | 'shop_weekday' | 'prep_weekday'>) {
  const base = addDays(week, -7)
  return {
    opens: `${addDays(base, r.card_weekday - 1)}T${r.card_time.slice(0, 5)}`,
    deadline: `${addDays(base, r.close_weekday - 1)}T${r.close_time.slice(0, 5)}`,
    einkauf: addDays(week, r.shop_weekday - 1),
    prep: addDays(week, r.prep_weekday - 1),
  }
}

/** Für welche Woche (Montag) läuft gerade eine Wahl? Ab Freitag die nächste. */
export function wahlWeek(now: string, r: Parameters<typeof planTimes>[1]): ISODate | null {
  const monday = startMonday(now.slice(0, 10))
  const next = addDays(monday, 7)
  return now >= planTimes(next, r).opens ? next : null
}
function startMonday(d: ISODate): ISODate {
  const wd = (fromISO(d).getDay() + 6) % 7
  return addDays(d, -wd)
}

export const fitsAbend = (r: MilaRecipe) => r.category !== 'fruehstueck' && (r.meal === 'abend' || r.meal === 'beides')
export const fitsMittag = (r: MilaRecipe) => r.category !== 'fruehstueck' && (r.meal === 'mittag' || r.meal === 'beides')

// ---------------------------------------------------------------------------
// Stapel: 3 × Anzahl je Mahlzeit, Mittag nur aus Mittag-tauglichen Gerichten
// ---------------------------------------------------------------------------

/** Feste Zufallszahl aus Text (gleiche Eingabe, gleiche Zahl) */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

const FISCH = /fisch|lachs|kabeljau|garnele|thunfisch|forelle|scampi/
const FLEISCH = /hack|rind|schwein|hähnch|huhn|pute|lamm|speck|chorizo|salami|schinken|wurst|steak|chashu|ente/
export function proteinOf(ings: MilaIngredient[]): 'fisch' | 'fleisch' | 'veggie' {
  const names = ings.filter((i) => !/sauce|soße|brühe|fond/i.test(i.name)).map((i) => i.name.toLowerCase())
  if (names.some((n) => FISCH.test(n))) return 'fisch'
  if (names.some((n) => FLEISCH.test(n))) return 'fleisch'
  return 'veggie'
}

export function lastCooked(weekDays: Pick<MilaWeekDay, 'recipe_id' | 'date' | 'is_leftover'>[], recipeId: string, before: ISODate): ISODate | null {
  let best: ISODate | null = null
  for (const d of weekDays) if (d.recipe_id === recipeId && !d.is_leftover && d.date < before && (!best || d.date > best)) best = d.date
  return best
}

export function buildDeck(input: {
  week: ISODate
  abend: number
  mittag: number
  recipes: MilaRecipe[]
  ingredientsOf: (id: string) => MilaIngredient[]
  weekDays: Pick<MilaWeekDay, 'recipe_id' | 'date' | 'is_leftover'>[]
  /** zuletzt eingefroren: kommen bevorzugt wieder */
  frozen: string[]
  seed: string
}): MilaDeckCard[] {
  const { week, recipes, weekDays, frozen, seed, ingredientsOf } = input
  const used = new Set<string>()
  const cards: MilaDeckCard[] = []
  const pick = (meal: MealSlot, n: number, fits: (r: MilaRecipe) => boolean) => {
    const pool = recipes.filter((r) => fits(r) && !used.has(r.id))
    const recent = (r: MilaRecipe) => {
      const last = lastCooked(weekDays, r.id, week)
      return !!last && daysBetween(last, week) < 21
    }
    // Erst nur Gerichte, die mindestens 3 Wochen nicht dran waren; reicht das nicht, auch die anderen
    const fresh = pool.filter((r) => !recent(r))
    const base = fresh.length >= n ? fresh : pool
    const cuisines = new Map<string, number>()
    const proteins = new Map<string, number>()
    for (let k = 0; k < n; k++) {
      let best: MilaRecipe | null = null
      let bestScore = -Infinity
      for (const r of base) {
        if (used.has(r.id)) continue
        const c = (r.cuisine ?? [])[0] ?? r.label ?? r.category
        const p = proteinOf(ingredientsOf(r.id))
        let score = hash(seed + meal + r.id) * 3
        if (r.prep_box) score += 1.5
        if (meal === 'abend' && r.cook_double) score += 1.2
        if (frozen.includes(r.id)) score += 6
        if (recent(r)) score -= 4
        score -= (cuisines.get(c) ?? 0) * 1.4 // abwechslungsreich: gleiche Küche weniger
        score -= (proteins.get(p) ?? 0) * 0.9 // und nicht nur Fleisch oder nur Fisch
        if (score > bestScore) {
          bestScore = score
          best = r
        }
      }
      if (!best) break
      used.add(best.id)
      const c = (best.cuisine ?? [])[0] ?? best.label ?? best.category
      const p = proteinOf(ingredientsOf(best.id))
      cuisines.set(c, (cuisines.get(c) ?? 0) + 1)
      proteins.set(p, (proteins.get(p) ?? 0) + 1)
      cards.push({ recipe_id: best.id, meal })
    }
  }
  // Mittag zuerst: dafür gibt es weniger passende Gerichte
  pick('mittag', input.mittag * 3, fitsMittag)
  pick('abend', input.abend * 3, fitsAbend)
  return [...cards.filter((c) => c.meal === 'abend'), ...cards.filter((c) => c.meal === 'mittag')]
}

/** Jeder sieht denselben Stapel in eigener Reihenfolge: erst Abend, dann Mittag, jeweils gemischt */
export function deckFor(deck: MilaDeckCard[], memberId: string): MilaDeckCard[] {
  const order = (c: MilaDeckCard) => hash(memberId + c.recipe_id)
  return [...deck.filter((c) => c.meal === 'abend').sort((a, b) => order(a) - order(b)), ...deck.filter((c) => c.meal === 'mittag').sort((a, b) => order(a) - order(b))]
}

// ---------------------------------------------------------------------------
// Haltbarkeit (geschätzt)
// ---------------------------------------------------------------------------

const FALLBACK: Record<string, number | null> = { obst_gemuese: 5, kuehl: 7, fleisch_fisch: 2, trocken: null, getraenke: null, sonstiges: 7 }

/** Tage ab Einkauf; null = unbegrenzt (Vorrat) */
export function ingredientDays(i: Pick<MilaIngredient, 'name' | 'pantry_basic' | 'shop_category'>, rules: Pick<MilaShelfRule, 'stichwort' | 'tage'>[]): number | null {
  if (i.pantry_basic || i.shop_category === 'trocken' || i.shop_category === 'getraenke') return null
  const n = i.name.toLowerCase()
  let best: number | null | undefined
  for (const r of rules) {
    if (!n.includes(r.stichwort.toLowerCase())) continue
    if (r.tage === null) {
      if (best === undefined) best = null
    } else if (best === undefined || best === null || r.tage < best) best = r.tage
  }
  if (best !== undefined) return best
  return FALLBACK[i.shop_category] ?? 7
}

/** Wird das Gericht im Prep komplett vorbereitet? */
export const isPrepped = (r: MilaRecipe) => (r.prep_info ? !!r.prep_info.tauglich : r.prep_box)

/**
 * Frist des Gerichts in Tagen ab Einkauf; null = unbegrenzt.
 * Robust (frische Zutaten halten 5 Tage oder länger): frisch zum Schluss kochen, kein Prep nötig.
 * Sonst, wenn Prep-tauglich: im Prep haltbar machen, ab Prep-Tag gilt die Prep-Haltbarkeit.
 * Sonst: empfindlich, zuerst kochen.
 */
export function dishDays(r: MilaRecipe, ings: MilaIngredient[], rules: MilaShelfRule[], prepOffset: number): { days: number | null; gruppe: MilaItemGroup } {
  let raw: number | null = null
  for (const i of ings) {
    const d = ingredientDays(i, rules)
    if (d !== null && (raw === null || d < raw)) raw = d
  }
  if (raw === null || raw >= 5) return { days: raw, gruppe: 'schluss' }
  if (isPrepped(r)) return { days: Math.max(raw, prepOffset + (r.prep_info?.haltbar_tage ?? 3)), gruppe: 'prep' }
  return { days: raw, gruppe: 'zuerst' }
}

// ---------------------------------------------------------------------------
// Kombo: Joker → Treffer → halbe Treffer → offen; bei zu vielen zuerst Prep und doppelt kochen
// ---------------------------------------------------------------------------

export type KomboItem = Omit<MilaPlanItem, 'id' | 'household_id' | 'plan_id' | 'parent_id' | 'created_at' | 'updated_at' | 'geplant_am' | 'gekocht_am'> & { key: string; parent_key: string | null }

const ART_RANK: Record<string, number> = { joker: 0, treffer: 1, halb: 2, offen: 3 }

export function buildKombo(input: {
  plan: Pick<MilaWeekPlan, 'deck' | 'abend_anzahl' | 'mittag_anzahl' | 'einkauf_tag' | 'prep_tag' | 'week'>
  eingang: { recipe_id: string; art: string }[]
  recipes: MilaRecipe[]
  ingredientsOf: (id: string) => MilaIngredient[]
  rules: MilaShelfRule[]
  seed: string
}): KomboItem[] {
  const { plan, eingang, rules, ingredientsOf } = input
  const byId = new Map(input.recipes.map((r) => [r.id, r]))
  const einkauf = plan.einkauf_tag ?? plan.week
  const prepDay = plan.prep_tag ?? einkauf
  const prepOffset = Math.max(0, daysBetween(einkauf, prepDay))
  const artOf = new Map(eingang.map((e) => [e.recipe_id, e.art]))
  const out: KomboItem[] = []

  const choose = (meal: MealSlot, n: number) => {
    const cards = plan.deck.filter((c) => c.meal === meal && byId.has(c.recipe_id))
    const ranked = cards
      .map((c) => {
        const r = byId.get(c.recipe_id)!
        const art = artOf.get(c.recipe_id) ?? 'offen'
        const bonus = (r.prep_box ? 1.5 : 0) + (meal === 'abend' && r.cook_double ? 1.5 : 0) + hash(input.seed + r.id)
        return { r, art, bonus }
      })
      .sort((a, b) => ART_RANK[a.art] - ART_RANK[b.art] || b.bonus - a.bonus)
    const taken = ranked.slice(0, n)
    const reserve = ranked.slice(n).filter((x) => x.art !== 'offen')
    for (const x of taken) out.push(item(x.r, meal, x.art as MilaItemArt, 'offen'))
    for (const x of reserve) out.push(item(x.r, meal, x.art as MilaItemArt, 'reserve'))
  }
  const item = (r: MilaRecipe, meal: MealSlot, art: MilaItemArt, status: 'offen' | 'reserve'): KomboItem => {
    const { days, gruppe } = dishDays(r, ingredientsOf(r.id), rules, prepOffset)
    return {
      key: meal + ':' + r.id,
      parent_key: null,
      recipe_id: r.id,
      slot: meal,
      gruppe,
      position: 0,
      art,
      portionen: meal === 'abend' ? ABEND_PORTIONEN : MITTAG_PORTIONEN,
      variante: 'original',
      status,
      frist_bis: days === null ? null : addDays(einkauf, days),
    }
  }
  choose('abend', plan.abend_anzahl)
  choose('mittag', plan.mittag_anzahl)
  return order(out, byId)
}

/** Reihenfolge: zuerst → prep → schluss, innerhalb nach Frist; Reste direkt hinter ihrem Gericht */
export function order(items: KomboItem[], byId: Map<string, MilaRecipe>): KomboItem[] {
  const G: Record<MilaItemGroup, number> = { zuerst: 0, prep: 1, schluss: 2 }
  const active = items.filter((i) => i.status !== 'reserve' && i.slot !== 'reste')
  const sorted = [...active].sort((a, b) => G[a.gruppe] - G[b.gruppe] || (a.frist_bis ?? '9999').localeCompare(b.frist_bis ?? '9999') || (a.slot === 'abend' ? -1 : 1) - (b.slot === 'abend' ? -1 : 1))
  const out: KomboItem[] = []
  for (const it of sorted) {
    out.push(it)
    const r = byId.get(it.recipe_id)
    if (it.slot === 'abend' && r?.cook_double) {
      out.push({ ...it, key: 'reste:' + it.recipe_id, parent_key: it.key, slot: 'reste', art: it.art, portionen: RESTE_PORTIONEN, frist_bis: null })
    }
  }
  const reserve = items.filter((i) => i.status === 'reserve')
  return [...out, ...reserve].map((x, k) => ({ ...x, position: k + 1 }))
}

/** Mahlzeiten der Kombo: Gerichte plus Reste-Mittage */
export function mealCount(items: Pick<MilaPlanItem, 'status' | 'slot'>[]) {
  const live = items.filter((i) => i.status !== 'reserve' && i.status !== 'getauscht')
  return { gerichte: live.filter((i) => i.slot !== 'reste').length, mahlzeiten: live.length }
}

/** Grobe Schätzung vorab: wie viele Abende ergeben Reste-Mittage? */
export const resteEstimate = (abend: number) => Math.min(2, Math.floor(abend / 2))

// ---------------------------------------------------------------------------
// Prep-Stunde
// ---------------------------------------------------------------------------

export function prepMinutes(recipes: MilaRecipe[], stepsOf: (id: string) => MilaStep[], prepStepsOf: (id: string) => MilaPrepStep[]): number {
  let min = 0
  for (const r of recipes) {
    const own = prepStepsOf(r.id)
    if (own.length) min += own.reduce((a, s) => a + (s.duration_min ?? 5), 0)
    else min += stepsOf(r.id).filter((s) => s.in_prep).reduce((a, s) => a + (s.timer_sec ?? 0) / 60, 0)
    min += 5
  }
  return Math.max(10, Math.round(min / 10) * 10)
}

// ---------------------------------------------------------------------------
// Heute dran und Kühlschrank-Ampel
// ---------------------------------------------------------------------------

const byFrist = (a: MilaPlanItem, b: MilaPlanItem) => (a.frist_bis ?? '9999').localeCompare(b.frist_bis ?? '9999') || a.position - b.position

/** Abend: was heute genommen wurde, sonst das offene Gericht mit der kürzesten Restfrist. Mittag: Reste vom Vortag, sonst Box. */
export function heuteDran(items: MilaPlanItem[], today: ISODate): { abend: MilaPlanItem | null; mittag: MilaPlanItem | null; restAbend: number; restMittag: number } {
  const open = items.filter((i) => i.status === 'offen')
  const cookedAbend = items.find((i) => i.slot === 'abend' && i.status === 'gekocht' && i.gekocht_am === today) ?? null
  const picked = open.find((i) => i.slot === 'abend' && i.geplant_am === today)
  const abend = cookedAbend ?? picked ?? open.filter((i) => i.slot === 'abend').sort(byFrist)[0] ?? null
  const parentDone = (i: MilaPlanItem) => {
    const p = items.find((x) => x.id === i.parent_id)
    return !!p && p.status === 'gekocht' && !!p.gekocht_am && p.gekocht_am < today
  }
  const lunches = open.filter((i) => i.slot === 'mittag' || (i.slot === 'reste' && parentDone(i)))
  const mittag = lunches.sort((a, b) => (a.slot === 'reste' ? -1 : 0) - (b.slot === 'reste' ? -1 : 0) || byFrist(a, b))[0] ?? items.find((i) => i.slot !== 'abend' && i.status === 'gekocht' && i.gekocht_am === today) ?? null
  return {
    abend,
    mittag,
    restAbend: open.filter((i) => i.slot === 'abend').length,
    restMittag: open.filter((i) => i.slot !== 'abend').length,
  }
}

/** Würde etwas verderben, wenn heute stattdessen etwas anderes gekocht wird? */
export const spoilsToday = (i: MilaPlanItem | null, today: ISODate) => !!i && !!i.frist_bis && i.frist_bis <= today

export type Ampel = 'rot' | 'gelb' | 'gruen'
export interface FridgeEntry {
  key: string
  name: string
  until: ISODate
  color: Ampel
  label: string
}

export function ampelOf(until: ISODate, today: ISODate): Ampel {
  const left = daysBetween(today, until)
  return left <= 0 ? 'rot' : left <= 2 ? 'gelb' : 'gruen'
}

export function fridge(input: {
  plan: Pick<MilaWeekPlan, 'einkauf_tag' | 'prep_tag' | 'adopted_at'>
  items: MilaPlanItem[]
  recipeById: (id: string) => MilaRecipe | null
  ingredientsOf: (id: string) => MilaIngredient[]
  rules: MilaShelfRule[]
  today: ISODate
  weekdayShort: (d: ISODate) => string
}): FridgeEntry[] {
  const { plan, items, today, rules } = input
  if (!plan.adopted_at || !plan.einkauf_tag || today < plan.einkauf_tag) return []
  const map = new Map<string, FridgeEntry>()
  const label = (until: ISODate, c: Ampel) => (c === 'rot' ? 'heute oder einfrieren' : `bis ${input.weekdayShort(until)}`)
  const put = (key: string, name: string, until: ISODate) => {
    const prev = map.get(key)
    if (prev && prev.until <= until) return
    const color = ampelOf(until, today)
    map.set(key, { key, name, until, color, label: label(until, color) })
  }
  for (const it of items) {
    if (it.status !== 'offen') continue
    const r = input.recipeById(it.recipe_id)
    if (!r) continue
    if (it.slot === 'reste') {
      const p = items.find((x) => x.id === it.parent_id)
      if (p?.status === 'gekocht' && p.gekocht_am) put('reste:' + it.id, `Reste ${r.name}`, it.frist_bis ?? addDays(p.gekocht_am, 2))
      continue
    }
    if (it.gruppe === 'prep' && plan.prep_tag && today >= plan.prep_tag && it.frist_bis) {
      put('box:' + it.id, `Box ${r.name}`, it.frist_bis)
      continue
    }
    for (const i of input.ingredientsOf(r.id)) {
      const d = ingredientDays(i, rules)
      if (d === null) continue
      put('z:' + i.name.toLowerCase(), i.name, addDays(plan.einkauf_tag, d))
    }
  }
  return [...map.values()].sort((a, b) => a.until.localeCompare(b.until) || a.name.localeCompare(b.name, 'de'))
}
