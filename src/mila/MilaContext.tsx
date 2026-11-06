// Mila · eigener Daten-Kontext. Wird nur unter #/mila/… eingehängt,
// Casa lädt davon nur die Woche (für Heute und Woche).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCasa } from '../state/HouseholdContext'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type {
  MealSlot, Member, MilaIngredient, MilaMenu, MilaPlan, MilaPrepStep, MilaRecipe, MilaSettings, MilaShoppingItem, MilaStep, MilaTableName,
  MilaVote, MilaVoteKind, MilaWeekDay, ShopCategory, TableName, Task,
} from '../lib/types'
import { categorize } from './shopping'
import { DEMO_MAX_ID } from '../lib/seed'
import { addDays, toISO } from '../lib/dates'
import { DEFAULT_RHYTHM, adoptWrites, cardWeek, computePlan, generateCard, menuTimes, relayout, workDays, type LocalStamp, type Rhythm, type WeekCtx } from './engine'
import { weekKey } from './week-list'

export interface Mila {
  ready: boolean
  error: string | null
  hid: string
  me: Member
  partner: Member | null
  members: Member[]
  store: Store
  recipes: MilaRecipe[]
  ingredients: MilaIngredient[]
  steps: MilaStep[]
  prepSteps: MilaPrepStep[]
  weekDays: MilaWeekDay[]
  items: MilaShoppingItem[]
  menus: MilaMenu[]
  votes: MilaVote[]
  rhythm: Rhythm
  ctx: WeekCtx
  recipeById(id: string | null | undefined): MilaRecipe | null
  ingredientsOf(recipeId: string): MilaIngredient[]
  stepsOf(recipeId: string): MilaStep[]
  prepStepsOf(recipeId: string): MilaPrepStep[]
  reload(table?: MilaTableName): Promise<void>

  /** Rezepte: neu anlegen oder (mit id) ersetzen; Zutaten, Schritte und Prep-Schritte kommen komplett mit */
  saveRecipe(recipe: RecipeInput, ingredients: IngredientInput[], steps: StepInput[], prep: PrepInput[], id?: string): Promise<string>

  /** Woche: eine Mahlzeit an einem Datum setzen, null leert sie */
  setMeal(date: string, meal: MealSlot, recipeId: string | null, servings?: number | null): Promise<void>

  /** Wochenkarte */
  vote(menu: MilaMenu, recipeId: string, meal: MealSlot, vote: MilaVoteKind): Promise<void>
  resetVotes(menu: MilaMenu, meal: MealSlot): Promise<void>
  setDone(menu: MilaMenu, done: boolean): Promise<void>
  reorder(menu: MilaMenu, dinners: string[], lunches: string[]): Promise<void>
  adopt(menu: MilaMenu): Promise<void>
  togglePrep(menu: MilaMenu, key: string): Promise<void>
  saveRhythm(patch: Partial<Rhythm>): Promise<void>

  /** Einkaufsliste */
  addItems(rows: NewItem[]): Promise<void>
  setChecked(id: string, checked: boolean): Promise<void>
  /** „meist Vorrat“ doch kaufen (oder zurück) */
  setStock(id: string, stock: boolean): Promise<void>
  finishShopping(): Promise<void>
}

export type RecipeInput = Pick<MilaRecipe, 'name' | 'category' | 'time_min' | 'portions' | 'valerie_tauglich' | 'devices' | 'notes' | 'valerie_note' | 'meal' | 'label' | 'blurb' | 'valerie_mag' | 'cook_double' | 'prep_box'>
export type IngredientInput = Pick<MilaIngredient, 'name' | 'amount' | 'unit' | 'pantry_basic'> & { id?: string; shop_category?: ShopCategory }
export type StepInput = Pick<MilaStep, 'title' | 'text' | 'timer_sec' | 'is_thermomix' | 'tm_time_sec' | 'tm_temp' | 'tm_speed' | 'tm_reverse' | 'ingredient_ids'>
export type PrepInput = Pick<MilaPrepStep, 'text' | 'duration_min' | 'runs_alongside' | 'box_label' | 'day_before'>

export interface NewItem {
  name: string
  amount?: string
  category?: ShopCategory
  source_label?: string | null
  source_week?: string | null
  source_recipe_ids?: string[]
  is_stock?: boolean
}

const Ctx = createContext<Mila | null>(null)

export function useMila(): Mila {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMila außerhalb des MilaProviders')
  return c
}

const TABLES: MilaTableName[] = ['mila_recipes', 'mila_ingredients', 'mila_steps', 'mila_prep_steps', 'mila_week_days', 'mila_shopping_items', 'mila_settings', 'mila_menus', 'mila_votes']

/** Felder, die ältere Zeilen (Demo) noch nicht haben: sinnvolle Standards */
export function withDefaults(r: MilaRecipe): MilaRecipe {
  return {
    ...r,
    meal: r.meal ?? (r.category === 'wochenende' || r.category === 'grill' ? 'abend' : 'beides'),
    label: r.label ?? null,
    blurb: r.blurb ?? null,
    valerie_mag: r.valerie_mag ?? false,
    cook_double: r.cook_double ?? r.category === 'mealprep',
    prep_box: r.prep_box ?? false,
  }
}

/** Jetzt als lokaler Zeitpunkt „YYYY-MM-DDTHH:MM“ */
export function nowStamp(d = new Date()): LocalStamp {
  return `${toISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
/** Lokaler Zeitpunkt → ISO (die App läuft in Berlin) */
const toIso = (s: LocalStamp) => new Date(s).toISOString()

/** Demo-Modus: die 30 Rezepte einmalig in den Browser legen (nur ein Lauf, auch wenn React im Dev-Modus doppelt lädt) */
let seeding: Promise<void> | null = null
function seedDemo(store: Store, hid: string): Promise<void> {
  if (!seeding) seeding = seedDemoOnce(store, hid)
  return seeding
}
async function seedDemoOnce(store: Store, hid: string) {
  const have = await store.select('mila_recipes', { household_id: hid })
  if (have.length) return
  const { default: seed } = await import('./seed.json')
  const recipes: Partial<MilaRecipe>[] = []
  const ingredients: Partial<MilaIngredient>[] = []
  const steps: Partial<MilaStep>[] = []
  for (const r of seed) {
    const { ingredients: ings, steps: sts, ...rest } = r
    recipes.push(withDefaults({ ...(rest as unknown as MilaRecipe), household_id: hid, created_by: DEMO_MAX_ID, updated_by: null }))
    for (const i of ings) ingredients.push({ ...(i as Partial<MilaIngredient>), household_id: hid })
    for (const s of sts) steps.push({ ...(s as Partial<MilaStep>), household_id: hid })
  }
  await store.insertMany('mila_recipes', recipes)
  await store.insertMany('mila_ingredients', ingredients)
  await store.insertMany('mila_steps', steps)
}

/** Karte nur einmal anlegen, auch wenn zwei Effekte gleichzeitig laufen */
let creating: string | null = null

export function MilaProvider({ children }: { children: ReactNode }) {
  const casa = useCasa()
  const store = useMemo<Store>(() => (isDemo ? new LocalStore() : new SupabaseStore(supabase!)), [])
  const me = casa.me
  const hid = me?.household_id ?? null

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<MilaRecipe[]>([])
  const [ingredients, setIngredients] = useState<MilaIngredient[]>([])
  const [steps, setSteps] = useState<MilaStep[]>([])
  const [prepSteps, setPrepSteps] = useState<MilaPrepStep[]>([])
  const [weekDays, setWeekDays] = useState<MilaWeekDay[]>([])
  const [items, setItems] = useState<MilaShoppingItem[]>([])
  const [settingsRow, setSettingsRow] = useState<MilaSettings | null>(null)
  const [menus, setMenus] = useState<MilaMenu[]>([])
  const [votes, setVotes] = useState<MilaVote[]>([])

  const load = useCallback(
    async (table?: MilaTableName) => {
      if (!hid) return
      try {
        const f = { household_id: hid }
        if (!table) {
          if (isDemo) await seedDemo(store, hid)
          const [r, i, s, p, w, it, st, mn, v] = await Promise.all([
            store.select('mila_recipes', f),
            store.select('mila_ingredients', f),
            store.select('mila_steps', f),
            store.select('mila_prep_steps', f),
            store.select('mila_week_days', f),
            store.select('mila_shopping_items', f),
            store.select('mila_settings', f),
            store.select('mila_menus', f),
            store.select('mila_votes', f),
          ])
          setRecipes(r.map(withDefaults))
          setIngredients(i)
          setSteps(s)
          setPrepSteps(p)
          setWeekDays(w)
          setItems(it)
          setSettingsRow(st[0] ?? null)
          setMenus(mn)
          setVotes(v)
          setReady(true)
          return
        }
        if (table === 'mila_recipes') setRecipes((await store.select('mila_recipes', f)).map(withDefaults))
        if (table === 'mila_ingredients') setIngredients(await store.select('mila_ingredients', f))
        if (table === 'mila_steps') setSteps(await store.select('mila_steps', f))
        if (table === 'mila_prep_steps') setPrepSteps(await store.select('mila_prep_steps', f))
        if (table === 'mila_week_days') setWeekDays(await store.select('mila_week_days', f))
        if (table === 'mila_shopping_items') setItems(await store.select('mila_shopping_items', f))
        if (table === 'mila_settings') setSettingsRow((await store.select('mila_settings', f))[0] ?? null)
        if (table === 'mila_menus') setMenus(await store.select('mila_menus', f))
        if (table === 'mila_votes') setVotes(await store.select('mila_votes', f))
      } catch (err) {
        setError((err as Error).message)
        setReady(true)
      }
    },
    [store, hid],
  )
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    loadRef.current()
  }, [hid])

  // Live: Änderungen (auch vom anderen) nachladen, und beim Zurückkommen in die App
  useEffect(() => {
    if (!hid) return
    const off = store.onChange(TABLES as TableName[], (t) => loadRef.current(t as MilaTableName))
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [store, hid])

  const rhythm: Rhythm = useMemo(() => {
    if (!settingsRow) return DEFAULT_RHYTHM
    const { household_id: _h, updated_at: _u, ...rest } = settingsRow
    void _h
    void _u
    return { ...DEFAULT_RHYTHM, ...rest, card_time: rest.card_time.slice(0, 5), close_time: rest.close_time.slice(0, 5), adopt_time: rest.adopt_time.slice(0, 5), prep_time: rest.prep_time.slice(0, 5) }
  }, [settingsRow])
  const ctx: WeekCtx = useMemo(() => ({ members: casa.members, events: casa.events, normalWeek: casa.normalWeek, overrides: casa.overrides }), [casa.members, casa.events, casa.normalWeek, casa.overrides])

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const ingByRecipe = useMemo(() => group(ingredients), [ingredients])
  const stepsByRecipe = useMemo(() => group(steps), [steps])
  const prepByRecipe = useMemo(() => group(prepSteps), [prepSteps])

  // ---------- Takt im Hintergrund: Karte anlegen, nach Frist aufdecken, Verteilung rechnen, automatisch übernehmen ----------
  const tickRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    if (!ready) return
    tickRef.current()
    const t = setInterval(() => tickRef.current(), 30_000)
    return () => clearInterval(t)
  }, [ready])
  useEffect(() => {
    if (ready) tickRef.current()
  }, [ready, menus, votes])

  if (!me || !hid) return null

  // Schreiben: erst lokal zeigen, dann speichern; bei Fehler neu laden
  const fail = (err: unknown, table: MilaTableName = 'mila_shopping_items') => {
    setError((err as Error).message)
    loadRef.current(table)
  }

  const recipeById = (id: string | null | undefined) => (id ? (byId.get(id) ?? null) : null)

  const saveRecipe = async (recipe: RecipeInput, ings: IngredientInput[], sts: StepInput[], prep: PrepInput[], id?: string) => {
    const rid = id ?? crypto.randomUUID()
    const ingRows: Partial<MilaIngredient>[] = ings.map((i, k) => ({
      id: i.id ?? crypto.randomUUID(),
      household_id: hid,
      recipe_id: rid,
      position: k,
      name: i.name.trim(),
      amount: i.amount,
      unit: i.unit.trim(),
      pantry_basic: i.pantry_basic,
      shop_category: i.shop_category ?? categorize(i.name),
    }))
    const known = new Set(ingRows.map((i) => i.id))
    const stepRows: Partial<MilaStep>[] = sts.map((s, k) => ({
      id: crypto.randomUUID(),
      household_id: hid,
      recipe_id: rid,
      position: k,
      ...s,
      ingredient_ids: s.ingredient_ids.filter((x) => known.has(x)),
    }))
    const prepRows: Partial<MilaPrepStep>[] = prep
      .filter((p) => p.text.trim())
      .map((p, k) => ({ household_id: hid, recipe_id: rid, position: k, ...p, text: p.text.trim(), box_label: p.box_label?.trim() || null }))
    try {
      if (id) {
        await store.update('mila_recipes', { id }, { ...recipe, updated_by: me.id })
        await store.remove('mila_ingredients', { recipe_id: id })
        await store.remove('mila_steps', { recipe_id: id })
        await store.remove('mila_prep_steps', { recipe_id: id })
      } else {
        await store.insert('mila_recipes', { id: rid, household_id: hid, ...recipe, image_url: null, created_by: me.id, updated_by: me.id })
      }
      await store.insertMany('mila_ingredients', ingRows)
      await store.insertMany('mila_steps', stepRows)
      await store.insertMany('mila_prep_steps', prepRows)
    } finally {
      await Promise.all(['mila_recipes', 'mila_ingredients', 'mila_steps', 'mila_prep_steps'].map((t) => loadRef.current(t as MilaTableName)))
    }
    return rid
  }

  const setMeal = async (date: string, meal: MealSlot, recipeId: string | null, servings?: number | null) => {
    const existing = weekDays.find((w) => w.date === date && (w.meal ?? 'abend') === meal)
    try {
      if (!recipeId) {
        if (existing) await store.remove('mila_week_days', { id: existing.id })
      } else if (existing) {
        await store.update('mila_week_days', { id: existing.id }, { recipe_id: recipeId, free_text: null, is_leftover: false, servings: servings ?? existing.servings, updated_by: me.id })
      } else {
        await store.insert('mila_week_days', { household_id: hid, date, meal, recipe_id: recipeId, free_text: null, is_leftover: false, servings: servings ?? null, added_to_list: false, created_by: me.id, updated_by: me.id })
      }
    } catch (err) {
      setError((err as Error).message)
    }
    await loadRef.current('mila_week_days')
  }

  // ---------- Wochenkarte ----------
  const vote = async (menu: MilaMenu, recipeId: string, meal: MealSlot, kind: MilaVoteKind) => {
    const mine = votes.filter((v) => v.menu_id === menu.id && v.member_id === me.id && v.meal === meal)
    const existing = mine.find((v) => v.recipe_id === recipeId)
    const oldJoker = kind === 'joker' ? mine.find((v) => v.vote === 'joker' && v.recipe_id !== recipeId) : undefined
    setVotes((prev) => {
      let next = prev.map((v) => (oldJoker && v.id === oldJoker.id ? { ...v, vote: 'ja' as const } : v))
      if (existing) next = next.map((v) => (v.id === existing.id ? { ...v, vote: kind } : v))
      else next = [...next, { id: 'neu-' + recipeId + meal, household_id: hid, menu_id: menu.id, member_id: me.id, recipe_id: recipeId, meal, vote: kind, created_at: new Date().toISOString() }]
      return next
    })
    try {
      if (oldJoker) await store.update('mila_votes', { id: oldJoker.id }, { vote: 'ja' })
      if (existing) await store.update('mila_votes', { id: existing.id }, { vote: kind })
      else await store.insert('mila_votes', { household_id: hid, menu_id: menu.id, member_id: me.id, recipe_id: recipeId, meal, vote: kind })
    } catch (err) {
      fail(err, 'mila_votes')
    }
    await loadRef.current('mila_votes')
  }

  const setDone = async (menu: MilaMenu, done: boolean) => {
    try {
      if (!isDemo && supabase) {
        const { error: e } = await supabase.rpc('mila_set_done', { p_menu: menu.id, p_done: done })
        if (e) throw e
      } else {
        const fresh = (await store.select('mila_menus', { id: menu.id }))[0] ?? menu
        const doneBy = done ? [...new Set([...fresh.done_by, me.id])] : fresh.done_by.filter((x) => x !== me.id)
        const partners = casa.members.filter((m) => m.role === 'partner').length
        await store.update('mila_menus', { id: menu.id }, { done_by: doneBy, revealed_at: doneBy.length >= partners ? new Date().toISOString() : null })
      }
    } catch (err) {
      fail(err, 'mila_menus')
    }
    await loadRef.current('mila_menus')
  }

  const resetVotes = async (menu: MilaMenu, meal: MealSlot) => {
    setVotes((prev) => prev.filter((v) => !(v.menu_id === menu.id && v.member_id === me.id && v.meal === meal)))
    try {
      await store.remove('mila_votes', { menu_id: menu.id, member_id: me.id, meal })
      if (menu.done_by.includes(me.id)) await setDone(menu, false)
    } catch (err) {
      fail(err, 'mila_votes')
    }
    await loadRef.current('mila_votes')
  }

  const reorder = async (menu: MilaMenu, dinners: string[], lunches: string[]) => {
    if (!menu.plan || menu.adopted_at) return
    const plan = relayout(menu.plan, dinners, lunches, menu.week, recipes, rhythm, ctx)
    setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, plan } : m)))
    try {
      await store.update('mila_menus', { id: menu.id }, { plan })
    } catch (err) {
      fail(err, 'mila_menus')
    }
  }

  const adopt = async (menu: MilaMenu, auto = false) => {
    if (!menu.plan || menu.adopted_at) return
    try {
      const mine = await store.claim('mila_menus', { id: menu.id, adopted_at: null }, { adopted_at: new Date().toISOString(), adopted_by: auto ? null : me.id })
      if (!mine) return
      await writeWeek(menu, menu.plan, auto)
    } catch (err) {
      fail(err, 'mila_menus')
    }
    await Promise.all(['mila_menus', 'mila_week_days', 'mila_shopping_items'].map((t) => loadRef.current(t as MilaTableName)))
    await casa.reloadMila()
  }

  /** Woche, Einkaufszettel und Vortag-Aufgaben auf einmal schreiben */
  async function writeWeek(menu: MilaMenu, plan: MilaPlan, auto: boolean) {
    const w = adoptWrites(menu, plan, recipes, ingredients, prepSteps, rhythm, ctx)
    const dates = workDays(menu.week)
    for (const d of weekDays.filter((x) => dates.includes(x.date))) await store.remove('mila_week_days', { id: d.id })
    await store.insertMany('mila_week_days', w.weekDays.map((d) => ({ household_id: hid!, ...d, free_text: null, added_to_list: true, created_by: auto ? null : me!.id, updated_by: auto ? null : me!.id })))
    const wk = weekKey(menu.week)
    for (const it of items.filter((i) => i.source_week === wk && !i.checked)) await store.remove('mila_shopping_items', { id: it.id })
    await store.insertMany('mila_shopping_items', w.items.map((r) => ({ household_id: hid!, ...r, added_by: null, checked: false, checked_by: null, checked_at: null })))
    // Aufgaben ohne Mitteilung: Ersteller = Besitzer
    for (const t of w.tasks) {
      const row: Partial<Task> = { household_id: hid!, title: t.title, owner_member_id: t.owner_member_id, due_date: t.due_date, status: 'offen', note: null, repeat: null, repeat_until: null, anchor_id: null, is_step: false, area: 'casa', fair_id: null, template_id: null, is_running: false, is_yearly: false, created_by: t.owner_member_id, updated_by: t.owner_member_id, done_at: null }
      await store.insert('tasks', row)
    }
  }

  const togglePrep = async (menu: MilaMenu, key: string) => {
    const done = menu.prep_done.includes(key) ? menu.prep_done.filter((k) => k !== key) : [...menu.prep_done, key]
    setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, prep_done: done } : m)))
    try {
      await store.update('mila_menus', { id: menu.id }, { prep_done: done })
    } catch (err) {
      fail(err, 'mila_menus')
    }
  }

  const saveRhythm = async (patch: Partial<Rhythm>) => {
    try {
      await store.upsert('mila_settings', { household_id: hid, ...rhythm, ...patch }, 'household_id')
    } catch (err) {
      setError((err as Error).message)
    }
    await loadRef.current('mila_settings')
  }

  // Takt: was gerade fällig ist
  tickRef.current = async () => {
    try {
      const now = nowStamp()
      // 1. Karte für die nächste Woche
      const wk = cardWeek(now, rhythm)
      if (wk && !menus.some((m) => m.week === wk) && creating !== wk && recipes.length) {
        creating = wk
        try {
          const t = menuTimes(wk, rhythm)
          const fresh = await store.select('mila_menus', { household_id: hid, week: wk })
          if (!fresh.length) {
            const card = generateCard({ week: wk, recipes, weekDays, votes, rhythm })
            await store.insert('mila_menus', { household_id: hid, week: wk, ...card, opens_at: toIso(t.opens), closes_at: toIso(t.closes), adopt_at: toIso(t.adopt), done_by: [], revealed_at: null, plan: null, adopted_at: null, adopted_by: null, prep_done: [], created_by: me.id })
          }
          await loadRef.current('mila_menus')
        } finally {
          creating = null
        }
        return
      }
      const iso = new Date().toISOString()
      const past = (x: string) => new Date(x).getTime() <= Date.now()
      for (const m of menus) {
        if (m.week < addDays(toISO(new Date()), -7)) continue
        // 2. Frist vorbei: aufdecken
        if (!m.revealed_at && past(m.closes_at)) {
          await store.claim('mila_menus', { id: m.id, revealed_at: null }, { revealed_at: iso })
          await Promise.all([loadRef.current('mila_menus'), loadRef.current('mila_votes')])
          return
        }
        // 3. Aufgedeckt: Verteilung rechnen (jetzt sind alle Stimmen sichtbar)
        if (m.revealed_at && !m.plan) {
          const all = await store.select('mila_votes', { menu_id: m.id })
          const plan = computePlan(m, all, recipes, rhythm, ctx)
          await store.claim('mila_menus', { id: m.id, plan: null }, { plan })
          await loadRef.current('mila_menus')
          return
        }
        // 4. Niemand hat übernommen: automatisch
        if (m.plan && !m.adopted_at && past(m.adopt_at)) {
          await adopt(m, true)
          return
        }
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const addItems = async (rows: NewItem[]) => {
    const now = new Date().toISOString()
    const full: Partial<MilaShoppingItem>[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        household_id: hid,
        name: r.name.trim(),
        amount: (r.amount ?? '').trim(),
        category: r.category ?? categorize(r.name),
        source_label: r.source_label ?? null,
        source_week: r.source_week ?? null,
        source_recipe_ids: r.source_recipe_ids ?? [],
        is_stock: r.is_stock ?? false,
        added_by: me.id,
        checked: false,
        checked_by: null,
        checked_at: null,
      }))
    if (!full.length) return
    const temp = full.map((r, i) => ({ ...r, id: 'neu-' + now + '-' + i, created_at: now }) as MilaShoppingItem)
    setItems((prev) => [...prev, ...temp])
    try {
      const saved = await store.insertMany('mila_shopping_items', full)
      // Platzhalter raus, Gespeichertes rein; nicht doppelt, falls das Nachladen schneller war
      const ids = new Set(saved.map((x) => x.id))
      setItems((prev) => [...prev.filter((p) => !temp.some((t) => t.id === p.id) && !ids.has(p.id)), ...saved])
    } catch (err) {
      fail(err)
    }
  }
  const setChecked = async (id: string, checked: boolean) => {
    const patch = { checked, checked_by: checked ? me.id : null, checked_at: checked ? new Date().toISOString() : null }
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    try {
      await store.update('mila_shopping_items', { id }, patch)
    } catch (err) {
      fail(err)
    }
  }
  const setStock = async (id: string, stock: boolean) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, is_stock: stock } : p)))
    try {
      await store.update('mila_shopping_items', { id }, { is_stock: stock })
    } catch (err) {
      fail(err)
    }
  }
  const finishShopping = async () => {
    const done = items.filter((i) => i.checked)
    setItems((prev) => prev.filter((p) => !p.checked))
    try {
      for (const d of done) await store.remove('mila_shopping_items', { id: d.id })
    } catch (err) {
      fail(err)
    }
  }

  const mila: Mila = {
    ready,
    error,
    hid,
    me,
    partner: casa.partner,
    members: casa.members,
    store,
    recipes,
    ingredients,
    steps,
    prepSteps,
    weekDays: weekDays.map((w) => ({ ...w, meal: w.meal ?? 'abend', is_leftover: w.is_leftover ?? false, servings: w.servings ?? null })),
    items: items.map((i) => ({ ...i, is_stock: i.is_stock ?? false })),
    menus: [...menus].sort((a, b) => b.week.localeCompare(a.week)),
    votes,
    rhythm,
    ctx,
    recipeById,
    ingredientsOf: (id) => ingByRecipe.get(id) ?? [],
    stepsOf: (id) => stepsByRecipe.get(id) ?? [],
    prepStepsOf: (id) => prepByRecipe.get(id) ?? [],
    reload: load,
    saveRecipe,
    setMeal,
    vote,
    resetVotes,
    setDone,
    reorder,
    adopt: (m) => adopt(m, false),
    togglePrep,
    saveRhythm,
    addItems,
    setChecked,
    setStock,
    finishShopping,
  }
  return <Ctx.Provider value={mila}>{children}</Ctx.Provider>
}

function group<T extends { recipe_id: string; position: number }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of [...rows].sort((a, b) => a.position - b.position)) m.set(r.recipe_id, [...(m.get(r.recipe_id) ?? []), r])
  return m
}
