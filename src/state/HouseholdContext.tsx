import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DemoAuth, SupabaseAuth, type Auth, type AuthUser } from '../lib/auth'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { Event, Household, ItemSeen, Member, NormalWeekRow, Person, Settings, Slot, Task, TaskStatus, WeekOverride, TableName, Repeat } from '../lib/types'
import { addDays, fromISO, toISO, today } from '../lib/dates'
import { subscribePush, unsubscribePush, type PushKeys } from '../lib/push'

export type SeenType = ItemSeen['item_type']

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
  people: Person[]
  settings: Settings | null
  tasks: Task[]
  events: Event[]
  normalWeek: NormalWeekRow[]
  overrides: WeekOverride[]
  seen: ItemSeen[]
  error: string | null

  /** NEU: vom anderen für mich eingetragen oder geändert und noch nicht angesehen */
  isNew(type: SeenType, item: { id: string; updated_at: string; created_by: string | null; updated_by: string | null }): boolean
  markSeen(type: SeenType, ids: string[]): Promise<void>

  addTask(input: { title: string; owner_member_id: string; due_date: string; note?: string | null; repeat?: Repeat | null; repeat_until?: string | null }): Promise<void>
  updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'owner_member_id' | 'due_date' | 'status' | 'note' | 'repeat' | 'repeat_until'>>): Promise<void>
  setTaskDone(id: string, done: boolean): Promise<void>
  removeTask(id: string): Promise<void>

  addEvent(input: {
    title: string
    date: string
    end_date?: string | null
    start_time?: string | null
    end_time?: string | null
    member_id: string | null
    person_id?: string | null
    note?: string | null
    repeat?: Repeat | null
    repeat_until?: string | null
  }): Promise<void>
  updateEvent(id: string, patch: Partial<Pick<Event, 'title' | 'date' | 'end_date' | 'start_time' | 'end_time' | 'member_id' | 'person_id' | 'note' | 'repeat' | 'repeat_until'>>): Promise<void>
  removeEvent(id: string): Promise<void>

  setOverride(input: { date: string; slot: Slot; value: string | null; at?: string | null; note?: string | null }): Promise<void>
  clearOverride(date: string, slot: Slot): Promise<void>
  setTemplate(input: { weekday: number; slot: Slot; value: string | null; at?: string | null; is_open: boolean; note?: string | null }): Promise<void>

  updateSettings(patch: Partial<Pick<Settings, 'dark_mode_auto' | 'briefing_time' | 'quiet_enabled' | 'quiet_hours_start' | 'quiet_hours_end'>>): Promise<void>

  /** Push auf diesem Gerät anmelden (braucht einen Tipp des Nutzers) */
  enablePush(): Promise<void>
  disablePush(): Promise<void>
  sendTestPush(): Promise<void>

  signOut(): Promise<void>
}

const Ctx = createContext<Casa | null>(null)

export function useCasa(): Casa {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCasa außerhalb des Providers')
  return c
}

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

export function CasaProvider({ children }: { children: ReactNode }) {
  const store = useMemo<Store>(() => (isDemo ? new LocalStore() : new SupabaseStore(supabase!)), [])
  const auth = useMemo<Auth>(() => (isDemo ? new DemoAuth() : new SupabaseAuth()), [])

  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [normalWeek, setNormalWeek] = useState<NormalWeekRow[]>([])
  const [overrides, setOverrides] = useState<WeekOverride[]>([])
  const [seen, setSeen] = useState<ItemSeen[]>([])

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
          const [t, e, n, o, p, sn] = await Promise.all([
            store.select('tasks', { household_id: hid }),
            store.select('events', { household_id: hid }),
            store.select('normal_week', { household_id: hid }),
            store.select('week_overrides', { household_id: hid }),
            store.select('people', { household_id: hid }),
            store.select('item_seen', { member_id: mine.id }),
          ])
          setTasks(t)
          setEvents(e)
          setNormalWeek(n)
          setOverrides(o)
          setPeople(p.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)))
          setSeen(sn)
          setDataReady(true)
          return
        }
        if (!householdId) return
        if (table === 'tasks') setTasks(await store.select('tasks', { household_id: householdId }))
        if (table === 'events') setEvents(await store.select('events', { household_id: householdId }))
        if (table === 'normal_week') setNormalWeek(await store.select('normal_week', { household_id: householdId }))
        if (table === 'week_overrides') setOverrides(await store.select('week_overrides', { household_id: householdId }))
        if (table === 'people') setPeople((await store.select('people', { household_id: householdId })).sort((a, b) => a.sort - b.sort))
        if (table === 'settings' && me) setSettings((await store.select('settings', { member_id: me.id }))[0] ?? null)
        if (table === 'item_seen' && me) setSeen(await store.select('item_seen', { member_id: me.id }))
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
      setPeople([])
      setTasks([])
      setEvents([])
      setNormalWeek([])
      setOverrides([])
      setSeen([])
      setSettings(null)
      setHousehold(null)
      return
    }
    loadRef.current()
  }, [user])

  // Live: Änderungen (auch vom anderen) nachladen
  useEffect(() => {
    if (!user) return
    const off = store.onChange(['tasks', 'events', 'normal_week', 'week_overrides', 'settings', 'members', 'people', 'item_seen'], (t) => loadRef.current(t))
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

  // „App geöffnet" merken (fürs Morgenbriefing), höchstens alle 5 Minuten
  const lastOpenedRef = useRef(0)
  useEffect(() => {
    if (!me) return
    const touch = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastOpenedRef.current < 5 * 60_000) return
      lastOpenedRef.current = now
      store.update('settings', { member_id: me.id }, { last_opened_at: new Date().toISOString() }).catch(() => {})
    }
    touch()
    document.addEventListener('visibilitychange', touch)
    return () => document.removeEventListener('visibilitychange', touch)
  }, [me, store])

  // --- Schreiben -----------------------------------------------------------
  const need = () => {
    if (!householdId || !me) throw new Error('Kein Haushalt geladen')
    return { hid: householdId, me }
  }

  /** Versand sofort anstoßen, damit der andere nicht bis zum nächsten Cron-Lauf wartet. */
  const flushPush = () => {
    if (isDemo || !supabase) return
    supabase.functions.invoke('send-push', { body: {} }).catch(() => {})
  }

  const seenMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of seen) m.set(s.item_type + ':' + s.item_id, s.seen_at)
    return m
  }, [seen])

  function nextDue(due: string, repeat: Repeat): string {
    const d = fromISO(due)
    if (repeat === 'weekly') d.setDate(d.getDate() + 7)
    if (repeat === 'monthly') d.setMonth(d.getMonth() + 1)
    if (repeat === 'yearly') d.setFullYear(d.getFullYear() + 1)
    return toISO(d)
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
    people,
    settings,
    tasks,
    events,
    normalWeek,
    overrides,
    seen,
    error,

    isNew(type, item) {
      if (!me) return false
      const actor = item.updated_by ?? item.created_by
      if (!actor || actor === me.id) return false
      const s = seenMap.get(type + ':' + item.id)
      return !s || s < item.updated_at
    },
    async markSeen(type, ids) {
      const { me } = need()
      const now = new Date().toISOString()
      const fresh = ids.filter((id) => {
        const s = seenMap.get(type + ':' + id)
        return !s || s < now
      })
      if (fresh.length === 0) return
      // Sofort lokal, dann speichern
      setSeen((prev) => [...prev.filter((s) => !(s.item_type === type && fresh.includes(s.item_id))), ...fresh.map((id) => ({ member_id: me.id, item_type: type, item_id: id, seen_at: now }))])
      for (const id of fresh) {
        await store.upsert('item_seen', { member_id: me.id, item_type: type, item_id: id, seen_at: now }, 'member_id,item_type,item_id')
      }
    },

    async addTask(input) {
      const { hid, me } = need()
      await store.insert('tasks', { household_id: hid, created_by: me.id, updated_by: me.id, status: 'offen', note: input.note ?? null, repeat: input.repeat ?? null, repeat_until: input.repeat_until ?? null, ...input })
      await load('tasks')
      flushPush()
    },
    async updateTask(id, patch) {
      const { me } = need()
      await store.update('tasks', { id }, { ...patch, updated_by: me.id })
      await load('tasks')
      flushPush()
    },
    async setTaskDone(id, done) {
      const { hid, me } = need()
      const status: TaskStatus = done ? 'erledigt' : 'offen'
      const doneAt = done ? new Date().toISOString() : null
      const task = tasks.find((t) => t.id === id)
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status, done_at: doneAt } : t)))
      await store.update('tasks', { id }, { status, done_at: doneAt, updated_by: me.id })
      // Wiederholung: nächste Aufgabe anlegen
      if (done && task?.repeat) {
        const next = nextDue(task.due_date, task.repeat)
        const exists = tasks.some((t) => t.title === task.title && t.due_date === next && t.status !== 'erledigt')
        if (!exists && (!task.repeat_until || next <= task.repeat_until)) {
          await store.insert('tasks', {
            household_id: hid,
            title: task.title,
            owner_member_id: task.owner_member_id,
            due_date: next,
            status: 'offen',
            note: task.note,
            repeat: task.repeat,
            repeat_until: task.repeat_until,
            created_by: task.created_by ?? me.id,
            updated_by: task.owner_member_id, // keine Mitteilung für die automatische Folgeaufgabe
          })
        }
      }
      await load('tasks')
    },
    async removeTask(id) {
      await store.remove('tasks', { id })
      await load('tasks')
    },

    async addEvent(input) {
      const { hid, me } = need()
      await store.insert('events', {
        household_id: hid,
        created_by: me.id,
        updated_by: me.id,
        note: input.note ?? null,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        end_date: input.end_date ?? null,
        person_id: input.person_id ?? null,
        repeat: input.repeat ?? null,
        repeat_until: input.repeat_until ?? null,
        ...input,
      })
      await load('events')
      flushPush()
    },
    async updateEvent(id, patch) {
      const { me } = need()
      await store.update('events', { id }, { ...patch, updated_by: me.id })
      await load('events')
      flushPush()
    },
    async removeEvent(id) {
      await store.remove('events', { id })
      await load('events')
    },

    async setOverride(input) {
      const { hid, me } = need()
      await store.upsert('week_overrides', { household_id: hid, created_by: me.id, updated_by: me.id, at: input.at ?? null, note: input.note ?? null, ...input }, 'household_id,date,slot')
      await load('week_overrides')
      flushPush()
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

    async enablePush() {
      const { me } = need()
      if (isDemo) throw new Error('Im Demo-Modus gibt es keine Mitteilungen.')
      if (!VAPID_PUBLIC_KEY) throw new Error('Push ist auf dem Server noch nicht eingerichtet.')
      const keys: PushKeys = await subscribePush(VAPID_PUBLIC_KEY)
      await store.upsert('push_subscriptions', { member_id: me.id, endpoint: keys.endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, 'endpoint')
    },
    async disablePush() {
      const endpoint = await unsubscribePush()
      if (endpoint) await store.remove('push_subscriptions', { endpoint })
    },
    async sendTestPush() {
      const { hid, me } = need()
      if (isDemo) throw new Error('Im Demo-Modus gibt es keine Mitteilungen.')
      await store.insert('notifications', {
        household_id: hid,
        recipient_member_id: me.id,
        kind: 'test',
        title: 'Casa',
        body: 'Test geglückt. So sehen Mitteilungen aus.',
        url: '#/einstellungen',
      })
      const { error } = await supabase!.functions.invoke('send-push', { body: {} })
      if (error) throw new Error('Versand hat nicht geklappt: ' + error.message)
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

export { addDays }
