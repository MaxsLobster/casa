// Mila · eigener Daten-Kontext. Wird nur unter #/mila/… eingehängt,
// Casa lädt davon nichts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCasa } from '../state/HouseholdContext'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { Member, MilaIngredient, MilaRecipe, MilaShoppingItem, MilaStep, MilaTableName, MilaWeekDay, ShopCategory, TableName } from '../lib/types'
import { categorize } from './shopping'
import { DEMO_MAX_ID } from '../lib/seed'

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
  weekDays: MilaWeekDay[]
  items: MilaShoppingItem[]
  recipeById(id: string | null | undefined): MilaRecipe | null
  ingredientsOf(recipeId: string): MilaIngredient[]
  stepsOf(recipeId: string): MilaStep[]
  reload(table?: MilaTableName): Promise<void>

  /** Rezepte: neu anlegen oder (mit id) ersetzen; Zutaten und Schritte kommen komplett mit */
  saveRecipe(recipe: RecipeInput, ingredients: IngredientInput[], steps: StepInput[], id?: string): Promise<string>

  /** Woche: ein Abendessen an einem Datum setzen (Rezept oder Freitext), null leert den Tag */
  setWeekDay(date: string, value: { recipe_id: string | null; free_text: string | null } | null): Promise<void>

  /** Einkaufsliste */
  addItems(rows: NewItem[]): Promise<void>
  setChecked(id: string, checked: boolean): Promise<void>
  finishShopping(): Promise<void>
}

export type RecipeInput = Pick<MilaRecipe, 'name' | 'category' | 'time_min' | 'portions' | 'valerie_tauglich' | 'devices' | 'notes' | 'valerie_note'>
export type IngredientInput = Pick<MilaIngredient, 'name' | 'amount' | 'unit' | 'pantry_basic'> & { id?: string; shop_category?: ShopCategory }
export type StepInput = Pick<MilaStep, 'title' | 'text' | 'timer_sec' | 'is_thermomix' | 'tm_time_sec' | 'tm_temp' | 'tm_speed' | 'tm_reverse' | 'ingredient_ids'>

export interface NewItem {
  name: string
  amount?: string
  category?: ShopCategory
  source_label?: string | null
  source_week?: string | null
  source_recipe_ids?: string[]
}

const Ctx = createContext<Mila | null>(null)

export function useMila(): Mila {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMila außerhalb des MilaProviders')
  return c
}

const TABLES: MilaTableName[] = ['mila_recipes', 'mila_ingredients', 'mila_steps', 'mila_week_days', 'mila_shopping_items']

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
    recipes.push({ ...(rest as Partial<MilaRecipe>), household_id: hid, created_by: DEMO_MAX_ID, updated_by: null })
    for (const i of ings) ingredients.push({ ...(i as Partial<MilaIngredient>), household_id: hid })
    for (const s of sts) steps.push({ ...(s as Partial<MilaStep>), household_id: hid })
  }
  await store.insertMany('mila_recipes', recipes)
  await store.insertMany('mila_ingredients', ingredients)
  await store.insertMany('mila_steps', steps)
}

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
  const [weekDays, setWeekDays] = useState<MilaWeekDay[]>([])
  const [items, setItems] = useState<MilaShoppingItem[]>([])

  const load = useCallback(
    async (table?: MilaTableName) => {
      if (!hid) return
      try {
        const f = { household_id: hid }
        if (!table) {
          if (isDemo) await seedDemo(store, hid)
          const [r, i, s, w, it] = await Promise.all([
            store.select('mila_recipes', f),
            store.select('mila_ingredients', f),
            store.select('mila_steps', f),
            store.select('mila_week_days', f),
            store.select('mila_shopping_items', f),
          ])
          setRecipes(r)
          setIngredients(i)
          setSteps(s)
          setWeekDays(w)
          setItems(it)
          setReady(true)
          return
        }
        if (table === 'mila_recipes') setRecipes(await store.select('mila_recipes', f))
        if (table === 'mila_ingredients') setIngredients(await store.select('mila_ingredients', f))
        if (table === 'mila_steps') setSteps(await store.select('mila_steps', f))
        if (table === 'mila_week_days') setWeekDays(await store.select('mila_week_days', f))
        if (table === 'mila_shopping_items') setItems(await store.select('mila_shopping_items', f))
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

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const ingByRecipe = useMemo(() => {
    const m = new Map<string, MilaIngredient[]>()
    for (const i of [...ingredients].sort((a, b) => a.position - b.position)) m.set(i.recipe_id, [...(m.get(i.recipe_id) ?? []), i])
    return m
  }, [ingredients])
  const stepsByRecipe = useMemo(() => {
    const m = new Map<string, MilaStep[]>()
    for (const s of [...steps].sort((a, b) => a.position - b.position)) m.set(s.recipe_id, [...(m.get(s.recipe_id) ?? []), s])
    return m
  }, [steps])

  if (!me || !hid) return null

  // Schreiben: erst lokal zeigen, dann speichern; bei Fehler neu laden
  const fail = (err: unknown) => {
    setError((err as Error).message)
    loadRef.current('mila_shopping_items')
  }
  const saveRecipe = async (recipe: RecipeInput, ings: IngredientInput[], sts: StepInput[], id?: string) => {
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
    try {
      if (id) {
        await store.update('mila_recipes', { id }, { ...recipe, updated_by: me.id })
        await store.remove('mila_ingredients', { recipe_id: id })
        await store.remove('mila_steps', { recipe_id: id })
      } else {
        await store.insert('mila_recipes', { id: rid, household_id: hid, ...recipe, image_url: null, created_by: me.id, updated_by: me.id })
      }
      await store.insertMany('mila_ingredients', ingRows)
      await store.insertMany('mila_steps', stepRows)
    } finally {
      await Promise.all([loadRef.current('mila_recipes'), loadRef.current('mila_ingredients'), loadRef.current('mila_steps')])
    }
    return rid
  }

  const setWeekDay = async (date: string, value: { recipe_id: string | null; free_text: string | null } | null) => {
    const existing = weekDays.find((w) => w.date === date)
    try {
      if (!value) {
        if (existing) await store.remove('mila_week_days', { id: existing.id })
      } else if (existing) {
        await store.update('mila_week_days', { id: existing.id }, { ...value, added_to_list: false, updated_by: me.id })
      } else {
        await store.insert('mila_week_days', { household_id: hid, date, ...value, added_to_list: false, created_by: me.id, updated_by: me.id })
      }
    } catch (err) {
      setError((err as Error).message)
    }
    await loadRef.current('mila_week_days')
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
    weekDays,
    items,
    recipeById: (id) => (id ? (byId.get(id) ?? null) : null),
    ingredientsOf: (id) => ingByRecipe.get(id) ?? [],
    stepsOf: (id) => stepsByRecipe.get(id) ?? [],
    reload: load,
    saveRecipe,
    setWeekDay,
    addItems,
    setChecked,
    finishShopping,
  }
  return <Ctx.Provider value={mila}>{children}</Ctx.Provider>
}
