// Mila · eigener Daten-Kontext. Wird nur unter #/mila/… eingehängt,
// Casa lädt davon nichts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCasa } from '../state/HouseholdContext'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { Member, MilaIngredient, MilaRecipe, MilaShoppingItem, MilaStep, MilaTableName, MilaWeekDay, TableName } from '../lib/types'
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
  }
  return <Ctx.Provider value={mila}>{children}</Ctx.Provider>
}
