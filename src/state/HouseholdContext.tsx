import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DemoAuth, SupabaseAuth, type Auth, type AuthUser } from '../lib/auth'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { Event, Household, Member, NormalWeekRow, Settings, Slot, Task, TaskStatus, WeekOverride, TableName } from '../lib/types'
import { today } from '../lib/dates'

export interface Casa {
  isDemo: boolean
  auth: Auth
  user: AuthUser | null
  authReady: boolean
  dataReady: boolean
  household: Household | null
  me: Member | null
  partner: Member | null
  members: Member[]
  settings: Settings | null
  tasks: Task[]
  events: Event[]
  normalWeek: NormalWeekRow[]
  overrides: WeekOverride[]
  error: string | null

  addTask(input: { title: string; owner_member_id: string; due_date: string; note?: string | null }): Promise<void>
  updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'owner_member_id' | 'due_date' | 'status' | 'note'>>): Promise<void>
  setTaskDone(id: string, done: boolean): Promise<void>
  removeTask(id: string): Promise<void>

  addEvent(input: { title: string; date: string; start_time?: string | null; end_time?: string | null; member_id: string | null; note?: string | null }): Promise<void>
  updateEvent(id: string, patch: Partial<Pick<Event, 'title' | 'date' | 'start_time' | 'end_time' | 'member_id' | 'note'>>): Promise<void>
  removeEvent(id: string): Promise<void>

  setOverride(input: { date: string; slot: Slot; value: string | null; at?: string | null; note?: string | null }): Promise<void>
  clearOverride(date: string, slot: Slot): Promise<void>
  setTemplate(input: { weekday: number; slot: Slot; value: string | null; at?: string | null; is_open: boolean; note?: string | null }): Promise<void>

  updateSettings(patch: Partial<Pick<Settings, 'dark_mode_auto'>>): Promise<void>
  signOut(): Promise<void>
}

const Ctx = createContext<Casa | null>(null)

export function useCasa(): Casa {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCasa außerhalb des Providers')
  return c
}

export function CasaProvider({ children }: { children: ReactNode }) {
  const store = useMemo<Store>(() => (isDemo ? new LocalStore() : new SupabaseStore(supabase!)), [])
  const auth = useMemo<Auth>(() => (isDemo ? new DemoAuth() : new SupabaseAuth()), [])

  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [normalWeek, setNormalWeek] = useState<NormalWeekRow[]>([])
  const [overrides, setOverrides] = useState<WeekOverride[]>([])

  // --- Anmeldung -----------------------------------------------------------
  useEffect(() => {
    let alive = true
    auth.current().then((u) => {
      if (!alive) return
      setUser(u)
      setAuthReady(true)
    })
    const off = auth.onChange((u) => {
      setUser(u)
      setAuthReady(true)
    })
    return () => {
      alive = false
      off()
    }
  }, [auth])

  const me = useMemo(() => (user ? (members.find((m) => m.user_id === user.id) ?? null) : null), [members, user])
  const partner = useMemo(() => (me ? (members.find((m) => m.id !== me.id && m.role === 'partner') ?? null) : null), [members, me])
  const householdId = me?.household_id ?? null

  // --- Daten laden ---------------------------------------------------------
  const load = useCallback(
    async (table?: TableName) => {
      if (!user) return
      try {
        if (!table || table === 'members') {
          const ms = await store.select('members')
          setMembers(ms)
          const mine = ms.find((m) => m.user_id === user.id)
          if (mine) {
            const hs = await store.select('households', { id: mine.household_id })
            setHousehold(hs[0] ?? null)
            const st = await store.select('settings', { member_id: mine.id })
            setSettings(st[0] ?? null)
          }
          if (table) return
          if (!mine) {
            setDataReady(true)
            return
          }
          const hid = mine.household_id
          const [t, e, n, o] = await Promise.all([
            store.select('tasks', { household_id: hid }),
            store.select('events', { household_id: hid }),
            store.select('normal_week', { household_id: hid }),
            store.select('week_overrides', { household_id: hid }),
          ])
          setTasks(t)
          setEvents(e)
          setNormalWeek(n)
          setOverrides(o)
          setDataReady(true)
          return
        }
        if (!householdId) return
        if (table === 'tasks') setTasks(await store.select('tasks', { household_id: householdId }))
        if (table === 'events') setEvents(await store.select('events', { household_id: householdId }))
        if (table === 'normal_week') setNormalWeek(await store.select('normal_week', { household_id: householdId }))
        if (table === 'week_overrides') setOverrides(await store.select('week_overrides', { household_id: householdId }))
        if (table === 'settings' && me) setSettings((await store.select('settings', { member_id: me.id }))[0] ?? null)
      } catch (err) {
        setError((err as Error).message)
        setDataReady(true)
      }
    },
    [store, user, householdId, me],
  )

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!user) {
      setDataReady(false)
      setMembers([])
      setTasks([])
      setEvents([])
      setNormalWeek([])
      setOverrides([])
      setSettings(null)
      setHousehold(null)
      return
    }
    loadRef.current()
  }, [user])

  // Live: Änderungen (auch vom anderen) nachladen
  useEffect(() => {
    if (!user) return
    const off = store.onChange(['tasks', 'events', 'normal_week', 'week_overrides', 'settings', 'members'], (t) => loadRef.current(t))
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [store, user])

  // --- Schreiben -----------------------------------------------------------
  const need = () => {
    if (!householdId || !me) throw new Error('Kein Haushalt geladen')
    return { hid: householdId, me }
  }

  const casa: Casa = {
    isDemo,
    auth,
    user,
    authReady,
    dataReady,
    household,
    me,
    partner,
    members,
    settings,
    tasks,
    events,
    normalWeek,
    overrides,
    error,

    async addTask(input) {
      const { hid, me } = need()
      await store.insert('tasks', { household_id: hid, created_by: me.id, status: 'offen', note: input.note ?? null, ...input })
      await load('tasks')
    },
    async updateTask(id, patch) {
      await store.update('tasks', { id }, patch)
      await load('tasks')
    },
    async setTaskDone(id, done) {
      const status: TaskStatus = done ? 'erledigt' : 'offen'
      // Sofort anzeigen, dann speichern
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status, done_at: done ? new Date().toISOString() : null } : t)))
      await store.update('tasks', { id }, { status, done_at: done ? new Date().toISOString() : null })
      await load('tasks')
    },
    async removeTask(id) {
      await store.remove('tasks', { id })
      await load('tasks')
    },

    async addEvent(input) {
      const { hid, me } = need()
      await store.insert('events', { household_id: hid, created_by: me.id, note: input.note ?? null, start_time: input.start_time ?? null, end_time: input.end_time ?? null, ...input })
      await load('events')
    },
    async updateEvent(id, patch) {
      await store.update('events', { id }, patch)
      await load('events')
    },
    async removeEvent(id) {
      await store.remove('events', { id })
      await load('events')
    },

    async setOverride(input) {
      const { hid, me } = need()
      await store.upsert('week_overrides', { household_id: hid, created_by: me.id, at: input.at ?? null, note: input.note ?? null, ...input }, 'household_id,date,slot')
      await load('week_overrides')
    },
    async clearOverride(date, slot) {
      const { hid } = need()
      await store.remove('week_overrides', { household_id: hid, date, slot })
      await load('week_overrides')
    },
    async setTemplate(input) {
      const { hid } = need()
      await store.upsert('normal_week', { household_id: hid, at: input.at ?? null, note: input.note ?? null, ...input }, 'household_id,weekday,slot')
      await load('normal_week')
    },

    async updateSettings(patch) {
      const { me } = need()
      await store.upsert('settings', { member_id: me.id, ...patch }, 'member_id')
      await load('settings')
    },
    async signOut() {
      await auth.signOut()
    },
  }

  return <Ctx.Provider value={casa}>{children}</Ctx.Provider>
}

/** Heute als Zustand, der um Mitternacht weiterspringt */
export function useToday(): string {
  const [d, setD] = useState(today())
  useEffect(() => {
    const t = setInterval(() => {
      const n = today()
      setD((prev) => (prev === n ? prev : n))
    }, 60_000)
    return () => clearInterval(t)
  }, [])
  return d
}

/** Aktuelle Zeit, minütlich aktualisiert (für „vorbei"-Prüfungen) */
export function useNow(): Date {
  const [n, setN] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setN(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return n
}
