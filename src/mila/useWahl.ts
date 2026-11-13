// Mila · Wochenwahl im Kontext: Pläne, eigene Wischer, Treffer, Kombo, Heute dran, Haltbarkeitsregeln.
// Wischen läuft über abgesicherte Datenbank-Funktionen (der andere sieht nie ein einzelnes Ja oder Nein).
// Im Demo-Modus (ohne Supabase) bilden einfache Funktionen hier dasselbe Verhalten nach.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { MealSlot, Member, MilaIngredient, MilaMatch, MilaPlanItem, MilaRecipe, MilaShelfRule, MilaShoppingItem, MilaSwipe, MilaVariantKey, MilaWahl, MilaWeekDay, MilaWeekPlan, TableName } from '../lib/types'
import { addDays, startOfWeek, today as todayISO, toISO } from '../lib/dates'
import { shoppingFor, shortName, type Rhythm } from './engine'
import { weekKey } from './week-list'
import { variantShopping } from './recipe-view'
import { DEFAULT_RULES, eingangFromSwipes, JOKER_PRO_WOCHE, RESTE_PORTIONEN, buildDeck, buildKombo, dishDays, daysBetween, planTimes, wahlWeek, type KomboItem } from './wahl'

export interface Wahl {
  plans: MilaWeekPlan[]
  /** Woche, für die gerade gewählt wird (ab Freitag die nächste) */
  nextPlan: MilaWeekPlan | null
  /** laufende Woche */
  currentPlan: MilaWeekPlan | null
  planItems: MilaPlanItem[]
  itemsOf(planId: string): MilaPlanItem[]
  matches: MilaMatch[]
  mySwipes: MilaSwipe[]
  /** wie viele Karten jeder schon gewischt hat (nur Zahlen) */
  stand: Record<string, number>
  rules: MilaShelfRule[]
  jokerLeft(planId: string): number
  setCounts(plan: MilaWeekPlan, abend: number, mittag: number): Promise<void>
  startDeck(plan: MilaWeekPlan): Promise<void>
  swipe(plan: MilaWeekPlan, recipeId: string, wahl: MilaWahl): Promise<{ treffer: boolean }>
  resetSwipes(plan: MilaWeekPlan): Promise<void>
  swapItem(item: MilaPlanItem, recipeId: string): Promise<void>
  adoptPlan(plan: MilaWeekPlan): Promise<void>
  cookItem(item: MilaPlanItem): Promise<void>
  pickToday(item: MilaPlanItem, freezeOther: MilaPlanItem | null): Promise<void>
  addToKombo(plan: MilaWeekPlan, recipeId: string, meal: MealSlot, portions: number, variant: MilaVariantKey): Promise<void>
  togglePlanPrep(plan: MilaWeekPlan, key: string): Promise<void>
  saveRule(rule: Partial<MilaShelfRule> & { stichwort: string; tage: number | null }): Promise<void>
  removeRule(id: string): Promise<void>
}

interface Deps {
  store: Store
  hid: string
  me: Member
  members: Member[]
  recipes: MilaRecipe[]
  recipeById(id: string | null | undefined): MilaRecipe | null
  ingredientsOf(id: string): MilaIngredient[]
  weekDays: MilaWeekDay[]
  items: MilaShoppingItem[]
  rhythm: Rhythm
  ready: boolean
  setError(msg: string): void
  reloadMila(table?: 'mila_week_days' | 'mila_shopping_items'): Promise<void>
  reloadCasa(): void
}

const toIso = (local: string) => new Date(local).toISOString()
const localNow = () => {
  const d = new Date()
  return `${toISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
let creatingPlan: string | null = null
let buildingKombo: string | null = null
let seedingRules: Promise<void> | null = null

export function useWahl(d: Deps): Wahl {
  const { store, hid, me } = d
  const [plans, setPlans] = useState<MilaWeekPlan[]>([])
  const [planItems, setPlanItems] = useState<MilaPlanItem[]>([])
  const [matches, setMatches] = useState<MilaMatch[]>([])
  const [mySwipes, setMySwipes] = useState<MilaSwipe[]>([])
  const [rules, setRules] = useState<MilaShelfRule[]>([])
  const [stand, setStand] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(
    async (table?: TableName) => {
      const f = { household_id: hid }
      try {
        if (!table || table === 'mila_week_plans') setPlans(await store.select('mila_week_plans', f))
        if (!table || table === 'mila_plan_items') setPlanItems(await store.select('mila_plan_items', f))
        if (!table || table === 'mila_matches') setMatches(await store.select('mila_matches', f))
        if (!table || table === 'mila_swipes') setMySwipes(await store.select('mila_swipes', { household_id: hid, member_id: me.id }))
        if (!table || table === 'mila_haltbarkeit_regeln') {
          let r = await store.select('mila_haltbarkeit_regeln', f)
          if (isDemo && !r.length) {
            // nur einmal anlegen, auch wenn React im Dev-Modus doppelt lädt
            seedingRules ??= store.insertMany('mila_haltbarkeit_regeln', DEFAULT_RULES.map(([stichwort, tage, gruppe]) => ({ household_id: hid, stichwort, tage, gruppe }))).then(() => undefined)
            await seedingRules
            r = await store.select('mila_haltbarkeit_regeln', f)
          }
          setRules(r)
        }
      } catch {
        /* Tabellen noch nicht da */
      }
      if (!table) setLoaded(true)
    },
    [store, hid, me.id],
  )
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    void loadRef.current()
    const off = store.onChange(['mila_week_plans', 'mila_plan_items', 'mila_matches', 'mila_swipes', 'mila_haltbarkeit_regeln'], (t) => loadRef.current(t))
    const onVisible = () => document.visibilityState === 'visible' && loadRef.current()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [store, hid])

  const today = todayISO()
  const thisMonday = startOfWeek(today)
  const nextPlan = plans.find((p) => p.week === addDays(thisMonday, 7)) ?? null
  const currentPlan = plans.find((p) => p.week === thisMonday) ?? null
  const itemsByPlan = useMemo(() => {
    const m = new Map<string, MilaPlanItem[]>()
    for (const i of [...planItems].sort((a, b) => a.position - b.position)) m.set(i.plan_id, [...(m.get(i.plan_id) ?? []), i])
    return m
  }, [planItems])
  const itemsOf = (id: string) => itemsByPlan.get(id) ?? []

  // ---------- Fortschritt (nur Zahlen) ----------
  const loadStand = useCallback(async (plan: MilaWeekPlan | null) => {
    if (!plan) return
    if (isDemo) {
      const all = await store.select('mila_swipes', { plan_id: plan.id })
      const out: Record<string, number> = {}
      for (const s of all) out[s.member_id] = (out[s.member_id] ?? 0) + 1
      setStand(out)
      return
    }
    const { data } = await supabase!.rpc('mila_wahl_stand', { p_plan: plan.id })
    setStand(Object.fromEntries(((data ?? []) as { member_id: string; gewischt: number }[]).map((r) => [r.member_id, r.gewischt])))
  }, [store])
  const wahlId = nextPlan?.id
  useEffect(() => {
    void loadStand(nextPlan)
    const t = setInterval(() => loadStand(nextPlan), 20_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wahlId, nextPlan?.beide_fertig_at, matches.length, mySwipes.length, loadStand])

  // ---------- Takt: Woche anlegen, Kombo bauen ----------
  const tick = useRef<() => Promise<void>>(async () => {})
  tick.current = async () => {
    if (!d.ready || !loaded) return
    const now = localNow()
    const wk = wahlWeek(now, d.rhythm)
    if (wk && !plans.some((p) => p.week === wk) && creatingPlan !== wk) {
      creatingPlan = wk
      try {
        const t = planTimes(wk, d.rhythm)
        const last = [...plans].sort((a, b) => b.week.localeCompare(a.week))[0]
        await store.insert('mila_week_plans', {
          household_id: hid, week: wk, abend_anzahl: last?.abend_anzahl ?? 5, mittag_anzahl: last?.mittag_anzahl ?? 2,
          deadline: toIso(t.deadline), status: 'wischen', deck: [], deck_built_at: null, beide_fertig_at: null, kombo_at: null,
          adopted_at: null, adopted_by: null, einkauf_tag: t.einkauf, prep_tag: t.prep, prep_done: [],
        })
      } catch {
        /* hat der andere schon angelegt */
      }
      creatingPlan = null
      await load('mila_week_plans')
      return
    }
    for (const p of plans) {
      if (p.status !== 'wischen') continue
      const due = new Date(p.deadline).getTime() <= Date.now() || !!p.beide_fertig_at
      if (due && buildingKombo !== p.id) {
        buildingKombo = p.id
        try {
          await komboFor(p)
        } finally {
          buildingKombo = null
        }
        return
      }
    }
  }
  useEffect(() => {
    void tick.current()
    const t = setInterval(() => tick.current(), 30_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    void tick.current()
  }, [plans, loaded, d.ready])

  // ---------- Hilfen ----------
  const eingangOf = async (plan: MilaWeekPlan): Promise<{ recipe_id: string; art: string }[]> => {
    if (!isDemo) {
      const { data, error } = await supabase!.rpc('mila_kombo_eingang', { p_plan: plan.id })
      if (error) throw error
      return (data ?? []) as { recipe_id: string; art: string }[]
    }
    return eingangFromSwipes(await store.select('mila_swipes', { plan_id: plan.id }))
  }

  const insertKombo = async (plan: MilaWeekPlan, rows: KomboItem[]) => {
    const ids = new Map(rows.map((r) => [r.key, crypto.randomUUID()]))
    const parents = rows.filter((r) => !r.parent_key)
    const children = rows.filter((r) => r.parent_key)
    const shape = (r: KomboItem) => {
      const { key, parent_key, ...rest } = r
      return { ...rest, id: ids.get(key)!, household_id: hid, plan_id: plan.id, parent_id: parent_key ? (ids.get(parent_key) ?? null) : null, geplant_am: null, gekocht_am: null }
    }
    await store.insertMany('mila_plan_items', parents.map(shape))
    if (children.length) await store.insertMany('mila_plan_items', children.map(shape))
  }

  const komboFor = async (plan: MilaWeekPlan) => {
    const eingang = await eingangOf(plan)
    // Nur einer baut: Status wischen → kombo umstellen; wer das schafft, schreibt die Gerichte
    const mine = await store.claim('mila_week_plans', { id: plan.id, status: 'wischen' }, { status: 'kombo', kombo_at: new Date().toISOString() })
    if (mine) {
      const rows = buildKombo({ plan, eingang, recipes: d.recipes, ingredientsOf: d.ingredientsOf, rules, seed: plan.id })
      await insertKombo(plan, rows)
    }
    await Promise.all([load('mila_week_plans'), load('mila_plan_items')])
  }

  const prepOffset = (plan: MilaWeekPlan) => Math.max(0, daysBetween(plan.einkauf_tag ?? plan.week, plan.prep_tag ?? plan.week))
  const fristFor = (plan: MilaWeekPlan, r: MilaRecipe) => {
    const { days, gruppe } = dishDays(r, d.ingredientsOf(r.id), rules, prepOffset(plan))
    return { gruppe, frist_bis: days === null ? null : addDays(plan.einkauf_tag ?? plan.week, days) }
  }

  const writeDay = async (date: string, meal: MealSlot, recipeId: string, servings: number, variant: MilaVariantKey, leftover: boolean) => {
    const cur = d.weekDays.find((w) => w.date === date && w.meal === meal)
    const row = { recipe_id: recipeId, free_text: null, is_leftover: leftover, servings, variant, updated_by: me.id }
    if (cur) await store.update('mila_week_days', { id: cur.id }, row)
    else await store.insert('mila_week_days', { household_id: hid, date, meal, added_to_list: false, created_by: me.id, ...row })
  }

  const fail = (err: unknown) => d.setError((err as Error).message)

  return {
    plans,
    nextPlan,
    currentPlan,
    planItems,
    itemsOf,
    matches,
    mySwipes,
    stand,
    rules,
    jokerLeft: (planId) => Math.max(0, JOKER_PRO_WOCHE - mySwipes.filter((s) => s.plan_id === planId && s.wahl === 'stern').length),

    async setCounts(plan, abend, mittag) {
      if (plan.deck_built_at) return
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, abend_anzahl: abend, mittag_anzahl: mittag } : p)))
      try {
        await store.update('mila_week_plans', { id: plan.id }, { abend_anzahl: abend, mittag_anzahl: mittag })
      } catch (err) {
        fail(err)
      }
      await load('mila_week_plans')
    },

    async startDeck(plan) {
      if (plan.deck_built_at) return
      const frozen = planItems.filter((i) => i.status === 'eingefroren').map((i) => i.recipe_id)
      const deck = buildDeck({ week: plan.week, abend: plan.abend_anzahl, mittag: plan.mittag_anzahl, recipes: d.recipes, ingredientsOf: d.ingredientsOf, weekDays: d.weekDays, frozen, seed: plan.id })
      try {
        await store.claim('mila_week_plans', { id: plan.id, deck_built_at: null }, { deck, deck_built_at: new Date().toISOString() })
      } catch (err) {
        fail(err)
      }
      await load('mila_week_plans')
    },

    async swipe(plan, recipeId, wahl) {
      const optimistic = { id: 'neu-' + recipeId, household_id: hid, plan_id: plan.id, member_id: me.id, recipe_id: recipeId, wahl, created_at: new Date().toISOString() }
      setMySwipes((prev) => [...prev.filter((s) => !(s.plan_id === plan.id && s.recipe_id === recipeId)), optimistic])
      let treffer = false
      try {
        if (!isDemo) {
          const { data, error } = await supabase!.rpc('mila_swipe', { p_plan: plan.id, p_recipe: recipeId, p_wahl: wahl })
          if (error) throw error
          treffer = !!(data as { treffer?: boolean })?.treffer
        } else {
          await store.upsert('mila_swipes', { household_id: hid, plan_id: plan.id, member_id: me.id, recipe_id: recipeId, wahl }, 'plan_id,member_id,recipe_id')
          const all = await store.select('mila_swipes', { plan_id: plan.id })
          // Demo: LocalStore kennt kein „unique“, deshalb doppelte Zeilen wegräumen
          const mineRows = all.filter((s) => s.member_id === me.id && s.recipe_id === recipeId)
          for (const extra of mineRows.slice(0, -1)) await store.remove('mila_swipes', { id: extra.id })
          treffer = wahl !== 'nein' && all.some((s) => s.member_id !== me.id && s.recipe_id === recipeId && s.wahl !== 'nein')
          const had = (await store.select('mila_matches', { plan_id: plan.id, recipe_id: recipeId })).length > 0
          if (treffer && !had) await store.insert('mila_matches', { household_id: hid, plan_id: plan.id, recipe_id: recipeId })
          if (!treffer && had) await store.remove('mila_matches', { plan_id: plan.id, recipe_id: recipeId })
          const fresh = await store.select('mila_swipes', { plan_id: plan.id })
          const counts = new Map<string, number>()
          for (const s of fresh) counts.set(s.member_id, (counts.get(s.member_id) ?? 0) + 1)
          const partners = d.members.filter((m) => m.role === 'partner')
          if (plan.deck.length && partners.every((p) => (counts.get(p.id) ?? 0) >= plan.deck.length) && !plan.beide_fertig_at) {
            await store.update('mila_week_plans', { id: plan.id }, { beide_fertig_at: new Date().toISOString() })
          }
        }
      } catch (err) {
        fail(err)
      }
      await Promise.all([load('mila_swipes'), load('mila_matches'), load('mila_week_plans')])
      return { treffer }
    },

    async resetSwipes(plan) {
      try {
        if (!isDemo) {
          const { error } = await supabase!.rpc('mila_swipes_reset', { p_plan: plan.id })
          if (error) throw error
        } else {
          for (const s of mySwipes.filter((x) => x.plan_id === plan.id)) {
            await store.remove('mila_matches', { plan_id: plan.id, recipe_id: s.recipe_id })
            await store.remove('mila_swipes', { id: s.id })
          }
          await store.update('mila_week_plans', { id: plan.id }, { beide_fertig_at: null })
        }
      } catch (err) {
        fail(err)
      }
      await Promise.all([load('mila_swipes'), load('mila_matches'), load('mila_week_plans')])
    },

    async swapItem(item, recipeId) {
      const plan = plans.find((p) => p.id === item.plan_id)
      const r = d.recipeById(recipeId)
      if (!plan || !r) return
      try {
        const children = planItems.filter((i) => i.parent_id === item.id)
        await store.update('mila_plan_items', { id: item.id }, { status: 'getauscht' })
        for (const c of children) await store.update('mila_plan_items', { id: c.id }, { status: 'getauscht' })
        const reserve = planItems.find((i) => i.plan_id === plan.id && i.recipe_id === recipeId && i.status === 'reserve')
        const { gruppe, frist_bis } = fristFor(plan, r)
        const id = crypto.randomUUID()
        if (reserve) await store.update('mila_plan_items', { id: reserve.id }, { status: 'offen', slot: item.slot, gruppe, frist_bis, position: item.position })
        else await store.insert('mila_plan_items', { id, household_id: hid, plan_id: plan.id, recipe_id: recipeId, slot: item.slot, gruppe, position: item.position, art: 'dazu', portionen: item.portionen, variante: 'original', status: 'offen', frist_bis, parent_id: null, geplant_am: null, gekocht_am: null })
        if (item.slot === 'abend' && r.cook_double) {
          await store.insert('mila_plan_items', { household_id: hid, plan_id: plan.id, recipe_id: recipeId, slot: 'reste', gruppe, position: item.position, art: reserve?.art ?? 'dazu', portionen: RESTE_PORTIONEN, variante: 'original', status: 'offen', frist_bis: null, parent_id: reserve?.id ?? id, geplant_am: null, gekocht_am: null })
        }
      } catch (err) {
        fail(err)
      }
      await load('mila_plan_items')
    },

    async adoptPlan(plan) {
      const ok = await store.claim('mila_week_plans', { id: plan.id, adopted_at: null }, { status: 'aktiv', adopted_at: new Date().toISOString(), adopted_by: me.id })
      if (ok) {
        try {
          // Einkaufszettel: offene Gerichte der Kombo, Reste werden beim Gericht mitgekocht
          const live = itemsOf(plan.id).filter((i) => i.status === 'offen')
          const date = plan.einkauf_tag ?? plan.week
          const shopRecipes = [...d.recipes]
          const shopIngs: MilaIngredient[] = []
          const slots = live
            .filter((i) => i.slot !== 'reste')
            .map((i) => {
              const r = d.recipeById(i.recipe_id)!
              const key = i.variante !== 'original' ? `${r.id}:${i.variante}` : r.id
              if (key !== r.id && !shopRecipes.some((x) => x.id === key)) {
                shopRecipes.push({ ...r, id: key })
                shopIngs.push(...variantShopping(r, d.ingredientsOf(r.id), i.variante).map((x) => ({ ...x, recipe_id: key })))
              }
              const reste = live.find((x) => x.parent_id === i.id)
              return { date, meal: (i.slot === 'abend' ? 'abend' : 'mittag') as MealSlot, recipe_id: key, leftover: false, servings: i.portionen + (reste?.portionen ?? 0) }
            })
          const ings = [...d.recipes.flatMap((r) => d.ingredientsOf(r.id)), ...shopIngs]
          const wk = weekKey(plan.week)
          for (const it of d.items.filter((x) => x.source_week === wk && !x.checked && x.source_label)) await store.remove('mila_shopping_items', { id: it.id })
          const rows = shoppingFor(plan.week, slots, shopRecipes, ings).map((row) => {
            const rids = [...new Set(row.source_recipe_ids.map((x) => x.split(':')[0]))]
            const names = rids.map((x) => shortName(d.recipeById(x)?.name ?? '')).filter(Boolean)
            return { ...row, source_recipe_ids: rids, source_label: names.length > 2 ? `${names.length} Gerichte` : names.join(' + ') }
          })
          await store.insertMany('mila_shopping_items', rows.map((r) => ({ household_id: hid, ...r, added_by: me.id, checked: false, checked_by: null, checked_at: null })))
        } catch (err) {
          fail(err)
        }
      }
      await Promise.all([load('mila_week_plans'), d.reloadMila('mila_shopping_items')])
    },

    async cookItem(item) {
      const date = todayISO()
      try {
        await store.update('mila_plan_items', { id: item.id }, { status: 'gekocht', gekocht_am: date })
        // Reste halten zwei Tage nach dem Kochen
        for (const c of planItems.filter((i) => i.parent_id === item.id)) await store.update('mila_plan_items', { id: c.id }, { frist_bis: addDays(date, 2) })
        const parent = planItems.find((i) => i.id === item.parent_id)
        const meal: MealSlot = item.slot === 'abend' ? 'abend' : 'mittag'
        await writeDay(date, meal, item.recipe_id, item.portionen, parent?.variante ?? item.variante, item.slot === 'reste')
      } catch (err) {
        fail(err)
      }
      await Promise.all([load('mila_plan_items'), d.reloadMila('mila_week_days')])
      d.reloadCasa()
    },

    async pickToday(item, freezeOther) {
      const date = todayISO()
      try {
        for (const o of planItems.filter((i) => i.plan_id === item.plan_id && i.geplant_am === date && i.id !== item.id)) await store.update('mila_plan_items', { id: o.id }, { geplant_am: null })
        await store.update('mila_plan_items', { id: item.id }, { geplant_am: date })
        // Würde sonst etwas verderben: einfrieren, kommt nächste Woche wieder auf den Stapel
        if (freezeOther) await store.update('mila_plan_items', { id: freezeOther.id }, { status: 'eingefroren', geplant_am: null })
      } catch (err) {
        fail(err)
      }
      await load('mila_plan_items')
      d.reloadCasa()
    },

    async addToKombo(plan, recipeId, meal, portions, variant) {
      const r = d.recipeById(recipeId)
      if (!r) return
      const { gruppe, frist_bis } = fristFor(plan, r)
      const pos = Math.max(0, ...itemsOf(plan.id).map((i) => i.position)) + 1
      try {
        await store.insert('mila_plan_items', { household_id: hid, plan_id: plan.id, recipe_id: recipeId, slot: meal, gruppe, position: pos, art: 'dazu', portionen: portions, variante: variant, status: 'offen', frist_bis, parent_id: null, geplant_am: null, gekocht_am: null })
      } catch (err) {
        fail(err)
      }
      await load('mila_plan_items')
    },

    async togglePlanPrep(plan, key) {
      const done = plan.prep_done.includes(key) ? plan.prep_done.filter((k) => k !== key) : [...plan.prep_done, key]
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, prep_done: done } : p)))
      try {
        await store.update('mila_week_plans', { id: plan.id }, { prep_done: done })
      } catch (err) {
        fail(err)
      }
    },

    async saveRule(rule) {
      try {
        if (rule.id) await store.update('mila_haltbarkeit_regeln', { id: rule.id }, { stichwort: rule.stichwort.trim().toLowerCase(), tage: rule.tage })
        else await store.insert('mila_haltbarkeit_regeln', { household_id: hid, stichwort: rule.stichwort.trim().toLowerCase(), tage: rule.tage, gruppe: rule.tage === null ? 'vorrat' : rule.tage <= 3 ? 'kurz' : rule.tage <= 5 ? 'mittel' : 'lang' })
      } catch (err) {
        fail(err)
      }
      await load('mila_haltbarkeit_regeln')
    },
    async removeRule(id) {
      try {
        await store.remove('mila_haltbarkeit_regeln', { id })
      } catch (err) {
        fail(err)
      }
      await load('mila_haltbarkeit_regeln')
    },
  }
}
