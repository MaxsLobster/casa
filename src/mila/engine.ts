// Mila · Rechnung für die Wochenkarte: Karte zusammenstellen, Treffer, Verteilung auf die Woche,
// Einkaufszettel, Prep-Plan. Reine Logik ohne React, läuft gleich in der App und in der Edge Function „mila-tick“
// (dort per esbuild gebündelt, siehe scripts/build-mila-tick.mjs).
import type {
  Event, MealSlot, Member, MilaIngredient, MilaMenu, MilaPlan, MilaPrepStep, MilaRecipe, MilaSettings, MilaVote, MilaWeekDay,
  NormalWeekRow, PlanHit, PlanSlot, ShopCategory, WeekOverride,
} from '../lib/types'
import { addDays, startOfWeek, weekdayShort, type ISODate } from '../lib/dates'
import { occurrences } from '../lib/recur'
import { applyEffects, dayEffects } from '../lib/effects'
import { dayState } from '../lib/week'
import { formatAmount } from './shopping'
import { scaleAmount } from './portions'
import { hashCode, weekKey } from './week-list'

// ---------------------------------------------------------------------------
// Rhythmus
// ---------------------------------------------------------------------------

export type Rhythm = Omit<MilaSettings, 'household_id' | 'updated_at'>

export const DEFAULT_RHYTHM: Rhythm = {
  lunches: 3,
  dinners: 3,
  card_weekday: 5,
  card_time: '18:00',
  close_weekday: 6,
  close_time: '12:00',
  adopt_weekday: 6,
  adopt_time: '14:00',
  shop_weekday: 6,
  prep_weekday: 7,
  prep_time: '17:00',
}

/** Lokaler Zeitpunkt „YYYY-MM-DDTHH:MM“ (Europe/Berlin) */
export type LocalStamp = string

const stamp = (date: ISODate, time: string): LocalStamp => `${date}T${time.slice(0, 5)}`

/** Für welche Woche (Montag) ist gerade eine Karte offen? Nur die nächste Woche, und erst ab „Karte ab“. */
export function cardWeek(now: LocalStamp, r: Rhythm): ISODate | null {
  const next = addDays(startOfWeek(now.slice(0, 10)), 7)
  return now >= menuTimes(next, r).opens ? next : null
}

/** Karte ab, Wahl schließt, automatisch übernehmen – alles in der Woche vor `week` */
export function menuTimes(week: ISODate, r: Rhythm): { opens: LocalStamp; closes: LocalStamp; adopt: LocalStamp } {
  const base = addDays(week, -7)
  const opens = stamp(addDays(base, r.card_weekday - 1), r.card_time)
  let closes = stamp(addDays(base, r.close_weekday - 1), r.close_time)
  if (closes < opens) closes = opens
  let adopt = stamp(addDays(base, r.adopt_weekday - 1), r.adopt_time)
  if (adopt < closes) adopt = closes
  return { opens, closes, adopt }
}

/** Tag der Prep-Stunde vor der Woche */
export function prepDate(week: ISODate, r: Rhythm): ISODate {
  return addDays(week, -7 + r.prep_weekday - 1)
}

/** Mo–Fr der Woche */
export function workDays(week: ISODate): ISODate[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(week, i))
}

// ---------------------------------------------------------------------------
// Karte zusammenstellen
// ---------------------------------------------------------------------------

export const CARD_SIZE = 8

export function fitsMeal(r: Pick<MilaRecipe, 'meal' | 'category'>, meal: MealSlot): boolean {
  if (r.category === 'fruehstueck') return false
  return r.meal === 'beides' || r.meal === meal
}

interface Stats {
  last: Map<string, ISODate>
  eaten: Map<string, number>
  liked: Map<string, number>
}

function stats(weekDays: MilaWeekDay[], votes: MilaVote[], before: ISODate): Stats {
  const last = new Map<string, ISODate>()
  const eaten = new Map<string, number>()
  for (const d of weekDays) {
    if (!d.recipe_id || d.is_leftover || d.date >= before) continue
    eaten.set(d.recipe_id, (eaten.get(d.recipe_id) ?? 0) + 1)
    if ((last.get(d.recipe_id) ?? '') < d.date) last.set(d.recipe_id, d.date)
  }
  const liked = new Map<string, number>()
  for (const v of votes) if (v.vote !== 'nein') liked.set(v.recipe_id, (liked.get(v.recipe_id) ?? 0) + (v.vote === 'joker' ? 2 : 1))
  return { last, eaten, liked }
}

/** Zuletzt gegessen (ohne Reste), für „zuletzt vor X Wochen“ */
export function lastEaten(weekDays: MilaWeekDay[], recipeId: string, before: ISODate): ISODate | null {
  let best: ISODate | null = null
  for (const d of weekDays) if (d.recipe_id === recipeId && !d.is_leftover && d.date < before && (!best || d.date > best)) best = d.date
  return best
}

/** „zuletzt vor 3 Wochen“ · „letzte Woche“ · „neu“ */
export function lastLabel(last: ISODate | null, today: ISODate): string {
  if (!last) return 'neu'
  const weeks = Math.round((new Date(today).getTime() - new Date(last).getTime()) / 604_800_000)
  if (weeks <= 1) return 'zuletzt letzte Woche'
  return `zuletzt vor ${weeks} Wochen`
}

/**
 * Bis zu 8 Gerichte je Karte, gemischt: Lieblinge (oft gewählt oder gegessen), lange nicht gegessen, 1–2 selten oder neu.
 * Nichts aus der Vorwoche, kein Frühstück, ein Gericht nur auf einer Karte. Würfeln fest pro Woche.
 */
export function generateCard(input: { week: ISODate; recipes: MilaRecipe[]; weekDays: MilaWeekDay[]; votes: MilaVote[]; rhythm: Rhythm }): { dinner_ids: string[]; lunch_ids: string[] } {
  const { week, recipes, weekDays, votes, rhythm } = input
  const recent = new Set(weekDays.filter((d) => d.recipe_id && d.date >= addDays(week, -7) && d.date <= addDays(week, 6)).map((d) => d.recipe_id as string))
  const pool = recipes.filter((r) => r.category !== 'fruehstueck' && !recent.has(r.id))
  const st = stats(weekDays, votes, week)
  const dice = (id: string, salt: string) => hashCode(week + salt + id)
  const fav = pool.filter((r) => (st.liked.get(r.id) ?? 0) + (st.eaten.get(r.id) ?? 0) > 0)
    .sort((a, b) => (st.liked.get(b.id) ?? 0) + (st.eaten.get(b.id) ?? 0) - ((st.liked.get(a.id) ?? 0) + (st.eaten.get(a.id) ?? 0)) || dice(a.id, 'f') - dice(b.id, 'f'))
  const long = pool.filter((r) => st.last.has(r.id)).sort((a, b) => (st.last.get(a.id) as string).localeCompare(st.last.get(b.id) as string) || dice(a.id, 'l') - dice(b.id, 'l'))
  const rare = pool.filter((r) => (st.eaten.get(r.id) ?? 0) <= 1).sort((a, b) => dice(a.id, 'n') - dice(b.id, 'n'))
  const any = [...pool].sort((a, b) => dice(a.id, 'a') - dice(b.id, 'a'))
  const lists = { fav, long, rare }
  const pattern: (keyof typeof lists)[] = ['fav', 'long', 'rare', 'fav', 'long', 'fav', 'long', 'rare']

  const used = new Set<string>()
  const cards: Record<MealSlot, string[]> = { abend: [], mittag: [] }
  const size: Record<MealSlot, number> = { abend: rhythm.dinners > 0 ? CARD_SIZE : 0, mittag: rhythm.lunches > 0 ? CARD_SIZE : 0 }
  for (let i = 0; i < CARD_SIZE; i++) {
    for (const meal of ['abend', 'mittag'] as MealSlot[]) {
      if (cards[meal].length >= size[meal]) continue
      const ok = (r: MilaRecipe) => !used.has(r.id) && fitsMeal(r, meal)
      const pick = lists[pattern[i]].find(ok) ?? any.find(ok)
      if (!pick) continue
      used.add(pick.id)
      cards[meal].push(pick.id)
    }
  }
  return { dinner_ids: cards.abend, lunch_ids: cards.mittag }
}

// ---------------------------------------------------------------------------
// Woche: wer ist da, wer kocht
// ---------------------------------------------------------------------------

export interface WeekCtx {
  members: Member[]
  /** inkl. Messetage */
  events: Event[]
  normalWeek: NormalWeekRow[]
  overrides: WeekOverride[]
}

export interface DayInfo {
  date: ISODate
  adults: number
  /** Valerie isst abends mit */
  valerieDinner: boolean
  /** Valerie isst mittags mit (Kita zu, Ferien) */
  valerieLunch: boolean
  /** beide weg: Tag fällt raus */
  skip: boolean
  /** Abends wird auswärts gegessen (Normalwoche z. B. „bei Freunden“): kein Abendessen planen */
  eatOut: boolean
}

export function dayInfo(date: ISODate, ctx: WeekCtx): DayInfo {
  const occ = occurrences(ctx.events, date, date).filter((o) => o.occ_date <= date && o.occ_end >= date)
  const fx = dayEffects(date, occ, ctx.members)
  const partners = ctx.members.filter((m) => m.role === 'partner')
  const adults = partners.filter((p) => !fx.away.some((a) => a.member.id === p.id)).length
  const valerieHome = !fx.valerieWeg
  const essen = applyEffects(dayState(date, ctx.normalWeek, ctx.overrides), fx).abend_essen
  const v = (essen?.value ?? '').trim()
  // Ein Name („Max“, „Oma“) oder „beide“ heißt: zu Hause wird gekocht. Alles andere („bei Freunden“) heißt auswärts.
  const eatOut = !!essen && !essen.is_open && !!v && !/^beide$/i.test(v) && !/^[A-ZÄÖÜ][a-zäöüß]+$/.test(v)
  return {
    date,
    adults,
    valerieDinner: valerieHome || fx.isLast,
    valerieLunch: valerieHome && !!fx.kitaZu,
    skip: adults === 0,
    eatOut,
  }
}

export function servingsFor(info: DayInfo, meal: MealSlot): number {
  const v = meal === 'abend' ? info.valerieDinner : info.valerieLunch
  return Math.max(1, info.adults + (v ? 1 : 0))
}

/** Wer kocht an dem Abend (aus der Normalwoche mit Abweichungen und Ereignissen)? */
export function cookOn(date: ISODate, ctx: WeekCtx): { value: string | null; open: boolean; member: Member | null } {
  const occ = occurrences(ctx.events, date, date).filter((o) => o.occ_date <= date && o.occ_end >= date)
  const st = applyEffects(dayState(date, ctx.normalWeek, ctx.overrides), dayEffects(date, occ, ctx.members))
  const e = st.abend_essen
  if (!e) return { value: null, open: false, member: null }
  const open = e.is_open || !e.value
  const member = !open ? (ctx.members.find((m) => m.display_name.trim().toLowerCase() === (e.value ?? '').trim().toLowerCase()) ?? null) : null
  return { value: open ? null : e.value, open, member }
}

// ---------------------------------------------------------------------------
// Aufdeckung: Treffer, Joker, Auffüllen, Reserve, Verteilung
// ---------------------------------------------------------------------------

interface Ranked extends PlanHit {
  vetoed: boolean
  dice: number
}

function rank(menu: Pick<MilaMenu, 'id'>, ids: string[], meal: MealSlot, votes: MilaVote[], voters: string[]): Ranked[] {
  const order = { joker: 0, treffer: 1, aufgefuellt: 2 }
  return ids
    .map((id) => {
      const vs = votes.filter((v) => v.recipe_id === id && v.meal === meal && voters.includes(v.member_id))
      const pos = vs.filter((v) => v.vote !== 'nein')
      const points = vs.reduce((n, v) => n + (v.vote === 'joker' ? 2 : v.vote === 'ja' ? 1 : 0), 0)
      const joker_by = vs.filter((v) => v.vote === 'joker').map((v) => v.member_id)
      const all = voters.length > 0 && voters.every((m) => pos.some((v) => v.member_id === m))
      const kind: PlanHit['kind'] = joker_by.length ? 'joker' : all ? 'treffer' : 'aufgefuellt'
      return { recipe_id: id, meal, kind, joker_by, points, vetoed: pos.length === 0 && vs.length > 0, dice: hashCode(menu.id + meal + id) }
    })
    .sort((a, b) => order[a.kind] - order[b.kind] || b.points - a.points || a.dice - b.dice)
}

/** Joker immer, dann Treffer nach Punkten, dann auffüllen (Gleichstand würfeln). Überzählige Treffer → Reserve. */
function choose(ranked: Ranked[], need: number): { chosen: Ranked[]; reserve: Ranked[] } {
  const chosen = ranked.filter((r) => r.kind === 'joker')
  const hits = ranked.filter((r) => r.kind === 'treffer')
  const reserve: Ranked[] = []
  for (const h of hits) (chosen.length < need ? chosen : reserve).push(h)
  for (const r of ranked) {
    if (chosen.length >= need) break
    if (r.kind === 'aufgefuellt' && !r.vetoed) chosen.push(r)
  }
  return { chosen, reserve }
}

const strip = ({ recipe_id, meal, kind, joker_by, points }: Ranked | PlanHit): PlanHit => ({ recipe_id, meal, kind, joker_by, points })

/**
 * Verteilt Abendessen und Mittage auf Mo–Fr. Abendessen auf die ersten freien Abende,
 * „doppelt → Mittag“ gibt Reste am nächsten Mittag, restliche Mittage aus der Mittagskarte.
 */
export function layout(dinners: string[], lunches: string[], days: DayInfo[], recipes: MilaRecipe[], r: Rhythm): { slots: PlanSlot[]; placedLunches: string[] } {
  const avail = days.filter((d) => !d.skip)
  const evenings = avail.filter((d) => !d.eatOut)
  const byDate = new Map(avail.map((d) => [d.date, d]))
  const recipe = (id: string) => recipes.find((x) => x.id === id)
  const slots: PlanSlot[] = []
  const lunchTaken = new Set<ISODate>()
  let budget = r.lunches
  dinners.slice(0, evenings.length).forEach((id, i) => {
    const d = evenings[i]
    slots.push({ date: d.date, meal: 'abend', recipe_id: id, leftover: false, servings: servingsFor(d, 'abend') })
    const next = byDate.get(addDays(d.date, 1))
    if (recipe(id)?.cook_double && next && budget > 0 && !lunchTaken.has(next.date)) {
      slots.push({ date: next.date, meal: 'mittag', recipe_id: id, leftover: true, servings: servingsFor(next, 'mittag') })
      lunchTaken.add(next.date)
      budget--
    }
  })
  const placedLunches: string[] = []
  for (const id of lunches) {
    if (budget <= 0) break
    const d = avail.find((x) => !lunchTaken.has(x.date))
    if (!d) break
    slots.push({ date: d.date, meal: 'mittag', recipe_id: id, leftover: false, servings: servingsFor(d, 'mittag') })
    lunchTaken.add(d.date)
    placedLunches.push(id)
    budget--
  }
  slots.sort((a, b) => a.date.localeCompare(b.date) || (a.meal === 'mittag' ? -1 : 1) - (b.meal === 'mittag' ? -1 : 1))
  return { slots, placedLunches }
}

/** Wer hat gewählt? Hat nur einer gewählt, zählt nur dessen Wahl. */
export function votersOf(menu: Pick<MilaMenu, 'id'>, votes: MilaVote[], members: Member[]): string[] {
  return members.filter((m) => m.role === 'partner' && votes.some((v) => v.menu_id === menu.id && v.member_id === m.id)).map((m) => m.id)
}

export function computePlan(menu: Pick<MilaMenu, 'id' | 'week' | 'dinner_ids' | 'lunch_ids'>, allVotes: MilaVote[], recipes: MilaRecipe[], r: Rhythm, ctx: WeekCtx): MilaPlan {
  const votes = allVotes.filter((v) => v.menu_id === menu.id)
  const voters = votersOf(menu, votes, ctx.members)
  const known = new Set(recipes.map((x) => x.id))
  const days = workDays(menu.week).map((d) => dayInfo(d, ctx))
  const avail = days.filter((d) => !d.skip)
  const evenings = avail.filter((d) => !d.eatOut)
  const recipe = (id: string) => recipes.find((x) => x.id === id)

  // Abendessen auswählen, dann so legen, dass „doppelt“ vor einem freien Mittag landet
  const dRanked = rank(menu, menu.dinner_ids.filter((id) => known.has(id)), 'abend', votes, voters)
  const dNeed = Math.min(r.dinners, evenings.length)
  const dPick = choose(dRanked, dNeed)
  const pool = [...dPick.chosen]
  const dinners: string[] = []
  let budget = r.lunches
  const count = Math.min(pool.length, evenings.length)
  for (let i = 0; i < count; i++) {
    const d = evenings[i]
    const nextFree = avail.some((x) => x.date === addDays(d.date, 1))
    const wantDouble = nextFree && budget > 0
    let k = pool.findIndex((p) => !!recipe(p.recipe_id)?.cook_double === wantDouble)
    if (k < 0) k = 0
    const [p] = pool.splice(k, 1)
    dinners.push(p.recipe_id)
    if (wantDouble && recipe(p.recipe_id)?.cook_double) budget--
  }
  dinners.push(...pool.map((p) => p.recipe_id)) // mehr Joker als Abende: hinten anhängen (werden nicht verteilt)

  // Mittage: so viele, wie nach den Resten noch frei sind
  const lunchDays = avail.length - (r.lunches - budget)
  const lNeed = Math.max(0, Math.min(budget, lunchDays))
  const lRanked = rank(menu, menu.lunch_ids.filter((id) => known.has(id)), 'mittag', votes, voters)
  const lPick = choose(lRanked, lNeed)
  const lunches = lPick.chosen.map((p) => p.recipe_id)

  const { slots } = layout(dinners, lunches, days, recipes, r)
  return {
    hits: [...dPick.chosen, ...lPick.chosen].map(strip),
    reserve: [...dPick.reserve, ...lPick.reserve].map(strip),
    dinners,
    lunches,
    slots,
    skipped: days.filter((d) => d.skip).map((d) => d.date),
    voters,
  }
}

/** Nach dem Ziehen: neu verteilen. Passen mehr Mittage hinein, kommen sie aus der Reserve; passen weniger, gehen sie in die Reserve. */
export function relayout(plan: MilaPlan, dinners: string[], lunches: string[], week: ISODate, recipes: MilaRecipe[], r: Rhythm, ctx: WeekCtx): MilaPlan {
  const days = workDays(week).map((d) => dayInfo(d, ctx))
  let reserve = [...plan.reserve]
  let ls = [...lunches]
  let out = layout(dinners, ls, days, recipes, r)
  // Platz für mehr Mittage? Aus der Reserve nachziehen
  for (let guard = 0; guard < 5; guard++) {
    const lunchCount = out.slots.filter((s) => s.meal === 'mittag').length
    const free = days.filter((d) => !d.skip).length - lunchCount
    if (out.placedLunches.length < ls.length || lunchCount >= r.lunches || free <= 0) break
    const extra = reserve.find((h) => h.meal === 'mittag')
    if (!extra) break
    reserve = reserve.filter((h) => h !== extra)
    ls = [...ls, extra.recipe_id]
    out = layout(dinners, ls, days, recipes, r)
  }
  // Nicht verteilte Mittage zurück in die Reserve
  const unplaced = ls.filter((id) => !out.placedLunches.includes(id))
  for (const id of unplaced) {
    const hit = plan.hits.find((h) => h.recipe_id === id && h.meal === 'mittag') ?? { recipe_id: id, meal: 'mittag' as MealSlot, kind: 'aufgefuellt' as const, joker_by: [], points: 0 }
    if (!reserve.some((h) => h.recipe_id === id)) reserve.unshift(hit)
  }
  ls = out.placedLunches
  const hits = [...plan.hits.filter((h) => h.meal === 'abend'), ...ls.map((id) => plan.hits.find((h) => h.recipe_id === id && h.meal === 'mittag') ?? plan.reserve.find((h) => h.recipe_id === id) ?? { recipe_id: id, meal: 'mittag' as MealSlot, kind: 'aufgefuellt' as const, joker_by: [], points: 0 })]
  return { ...plan, hits, reserve, dinners, lunches: ls, slots: out.slots }
}

// ---------------------------------------------------------------------------
// Einkaufszettel
// ---------------------------------------------------------------------------

export interface ShopRow {
  name: string
  amount: string
  category: ShopCategory
  is_stock: boolean
  source_label: string | null
  source_week: string
  source_recipe_ids: string[]
}

/** Zutaten × Portionen zusammengerechnet; „meist Vorrat“ als eigene graue Zeilen. Reste zählen beim Kochabend. */
export function shoppingFor(week: ISODate, slots: Pick<PlanSlot, 'date' | 'meal' | 'recipe_id' | 'leftover' | 'servings'>[], recipes: MilaRecipe[], ingredients: MilaIngredient[]): ShopRow[] {
  interface Bucket { name: string; unit: string; amount: number; has: boolean; cat: ShopCategory; stock: boolean; dates: Set<ISODate>; rids: Set<string>; names: Set<string> }
  const buckets = new Map<string, Bucket>()
  for (const s of slots) {
    const r = recipes.find((x) => x.id === s.recipe_id)
    if (!r) continue
    const cookDate = s.leftover ? addDays(s.date, -1) : s.date
    const factor = Math.max(1, s.servings) / Math.max(1, r.portions)
    for (const i of ingredients.filter((x) => x.recipe_id === r.id)) {
      const name = i.name.trim()
      if (!name || /^wasser$/i.test(name)) continue
      const unit = (i.unit ?? '').trim()
      const key = name.toLowerCase() + '|' + unit.toLowerCase()
      let b = buckets.get(key)
      if (!b) {
        b = { name, unit, amount: 0, has: false, cat: i.shop_category, stock: true, dates: new Set(), rids: new Set(), names: new Set() }
        buckets.set(key, b)
      }
      if (i.amount !== null && i.amount !== undefined) {
        b.amount += Number(i.amount) * factor
        b.has = true
      }
      if (!i.pantry_basic) b.stock = false
      b.dates.add(cookDate)
      b.rids.add(r.id)
      b.names.add(r.name)
    }
  }
  const wk = weekKey(week)
  return [...buckets.values()].map((b) => {
    const dates = [...b.dates].sort()
    return {
      name: b.name,
      amount: formatAmount(b.has ? scaleAmount(b.amount, b.unit, 1) : null, b.unit),
      category: b.cat,
      is_stock: b.stock,
      source_label: dates.length === 1 && b.names.size === 1 ? `${weekdayShort(dates[0])} · ${[...b.names][0]}` : dates.map((d) => weekdayShort(d)).join(' + '),
      source_week: wk,
      source_recipe_ids: [...b.rids],
    }
  })
}

// ---------------------------------------------------------------------------
// Prep-Stunde
// ---------------------------------------------------------------------------

export interface PrepItem {
  key: string
  text: string
  meta: string
  duration: number | null
  alongside: boolean
}

export interface PrepBox {
  key: string
  day: string
  what: string
  lunch: boolean
}

export interface DayBeforeTask {
  date: ISODate // fällig
  title: string
  forDate: ISODate
  meal: MealSlot
}

export interface PrepPlan {
  items: PrepItem[]
  boxes: PrepBox[]
  tasks: DayBeforeTask[]
  total: number
}

type WeekRow = Pick<MilaWeekDay, 'date' | 'meal' | 'recipe_id' | 'is_leftover'>

const dayTag = (date: ISODate, meal: MealSlot) => (meal === 'mittag' ? `${weekdayShort(date)} · Mittag` : weekdayShort(date))

/**
 * Aus den Prep-Schritten der Woche. Ohne Prep-Schritte: jedes Mittagessen (nicht Reste) komplett vorkochen,
 * Abendessen nur bei „Prep-Box“. Lange und „nebenbei“-Schritte zuerst. „erst am Vortag“ → Aufgabe.
 */
export function prepPlan(rows: WeekRow[], prepDay: ISODate, recipes: MilaRecipe[], prepSteps: MilaPrepStep[]): PrepPlan {
  const items: PrepItem[] = []
  const boxes: PrepBox[] = []
  const tasks: DayBeforeTask[] = []
  const sorted = [...rows].filter((r) => r.recipe_id && !r.is_leftover).sort((a, b) => a.date.localeCompare(b.date) || (a.meal === 'mittag' ? -1 : 1) - (b.meal === 'mittag' ? -1 : 1))
  for (const row of sorted) {
    const r = recipes.find((x) => x.id === row.recipe_id)
    if (!r) continue
    const tag = dayTag(row.date, row.meal)
    const steps = prepSteps.filter((s) => s.recipe_id === r.id).sort((a, b) => a.position - b.position)
    if (steps.length) {
      steps.forEach((s, k) => {
        const before = addDays(row.date, -1)
        if (s.day_before && before !== prepDay) {
          tasks.push({ date: before, title: `${s.text} · für ${tag}: ${r.name}`, forDate: row.date, meal: row.meal })
          return
        }
        const meta = [s.duration_min ? `${s.duration_min} Min` : null, s.runs_alongside ? 'läuft nebenbei' : null, `für ${tag} · ${r.name}`].filter(Boolean).join(' · ')
        items.push({ key: `${row.date}|${row.meal}|${k}`, text: s.text, meta, duration: s.duration_min, alongside: s.runs_alongside })
        if (s.box_label?.trim()) boxes.push({ key: `${row.date}|${row.meal}|${k}`, day: tag, what: s.box_label.trim(), lunch: row.meal === 'mittag' })
      })
      continue
    }
    if (row.meal === 'mittag' || r.prep_box) {
      const verbTxt = row.meal === 'mittag' ? 'komplett vorkochen und in die Box' : 'vorbereiten und in die Box'
      items.push({ key: `${row.date}|${row.meal}|0`, text: `${r.name} ${verbTxt}`, meta: [r.time_min ? `${r.time_min} Min` : null, `für ${tag}`].filter(Boolean).join(' · '), duration: r.time_min, alongside: false })
      boxes.push({ key: `${row.date}|${row.meal}|0`, day: tag, what: r.name, lunch: row.meal === 'mittag' })
    }
  }
  items.sort((a, b) => Number(b.alongside) - Number(a.alongside) || (b.duration ?? 0) - (a.duration ?? 0))
  const active = items.filter((i) => !i.alongside).reduce((n, i) => n + (i.duration ?? 0), 0)
  const along = Math.max(0, ...items.filter((i) => i.alongside).map((i) => i.duration ?? 0))
  return { items, boxes, tasks, total: Math.max(active, along) }
}

// ---------------------------------------------------------------------------
// Übernehmen: was auf einmal entsteht
// ---------------------------------------------------------------------------

export interface AdoptWrites {
  weekDays: Pick<MilaWeekDay, 'date' | 'meal' | 'recipe_id' | 'is_leftover' | 'servings'>[]
  items: ShopRow[]
  tasks: { title: string; due_date: ISODate; owner_member_id: string | null }[]
}

export function adoptWrites(menu: Pick<MilaMenu, 'week'>, plan: MilaPlan, recipes: MilaRecipe[], ingredients: MilaIngredient[], prepSteps: MilaPrepStep[], r: Rhythm, ctx: WeekCtx): AdoptWrites {
  const weekDays = plan.slots.map((s) => ({ date: s.date, meal: s.meal, recipe_id: s.recipe_id, is_leftover: s.leftover, servings: s.servings }))
  const items = shoppingFor(menu.week, plan.slots, recipes, ingredients)
  const prep = prepPlan(weekDays, prepDate(menu.week, r), recipes, prepSteps)
  // Vortag-Aufgabe: Abendessen beim Koch des Abends, Mittag beim Koch des Vorabends
  const tasks = prep.tasks.map((t) => {
    const cook = cookOn(t.meal === 'abend' ? t.forDate : t.date, ctx)
    return { title: t.title, due_date: t.date, owner_member_id: cook.member?.id ?? null }
  })
  return { weekDays, items, tasks }
}

/** Kurzname für Zeilen wie „Reste vom Curry“: der Teil vor „mit“ */
export function shortName(name: string): string {
  return name.split(/\s+(mit|und|an|auf|vom|im)\s+/i)[0].trim()
}
