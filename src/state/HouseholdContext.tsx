import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DemoAuth, SupabaseAuth, type Auth, type AuthUser } from '../lib/auth'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { Anchor, AnchorLog, AnchorLogKind, AnchorPhase, AnchorPin, AnchorQuestion, AnchorVisibility, Area, Event, EventEffect, Fair, Household, Idea, ItemSeen, Member, NormalWeekRow, Person, Settings, Slot, Task, TaskStatus, TemplateRow, WeekOverride, TableName, Repeat } from '../lib/types'
import { addDays, fromISO, toISO, today } from '../lib/dates'
import { subscribePush, unsubscribePush, type PushKeys } from '../lib/push'
import { phaseLabel } from '../lib/anchors'
import { dueFor, fairEvents, nextFair, roundStart } from '../lib/mwf'

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
  anchors: Anchor[]
  anchorLog: AnchorLog[]
  anchorQuestions: AnchorQuestion[]
  /** meine gepinnten Anker (Auf Startseite) */
  pins: Set<string>
  // MWF
  fairs: Fair[]
  template: TemplateRow[]
  ideas: Idea[]
  error: string | null

  /** NEU: vom anderen für mich eingetragen oder geändert und noch nicht angesehen */
  isNew(type: SeenType, item: { id: string; updated_at: string; created_by: string | null; updated_by: string | null; date?: string; end_date?: string | null; occ_end?: string }): boolean
  markSeen(type: SeenType, ids: string[]): Promise<void>

  addTask(input: { title: string; owner_member_id: string | null; due_date: string; note?: string | null; repeat?: Repeat | null; repeat_until?: string | null; anchor_id?: string | null; is_step?: boolean; area?: Area; is_yearly?: boolean }): Promise<Task>
  updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'owner_member_id' | 'due_date' | 'status' | 'note' | 'repeat' | 'repeat_until' | 'anchor_id'>>): Promise<void>
  setTaskDone(id: string, done: boolean): Promise<void>
  removeTask(id: string): Promise<void>
  /** Offene Aufgabe übernehmen: ich werde Besitzer (keine Mitteilung) */
  takeTask(id: string): Promise<void>

  // Anker
  addAnchor(input: { title: string; why: string | null; visibility: AnchorVisibility; area?: Area }): Promise<Anchor>
  updateAnchor(id: string, patch: Partial<Pick<Anchor, 'title' | 'why' | 'visibility' | 'notes' | 'ask_next'>>): Promise<void>
  setAnchorPhase(id: string, phase: AnchorPhase): Promise<void>
  archiveAnchor(id: string, archived: boolean): Promise<void>
  addAnchorLog(id: string, kind: AnchorLogKind, text: string): Promise<void>
  /** Nächsten Schritt festlegen oder ändern (die Aufgabe des Ankers) */
  setStep(anchorId: string, input: { title: string; owner_member_id: string | null; due_date: string }): Promise<void>
  addQuestion(anchorId: string, text: string): Promise<void>
  resolveQuestion(id: string, answer: string | null): Promise<void>
  reopenQuestion(id: string): Promise<void>
  removeQuestion(id: string): Promise<void>
  setPin(anchorId: string, on: boolean): Promise<void>

  // MWF
  /** Arbeitstag heute an/aus (pro Person, um Mitternacht automatisch aus) */
  setWorkday(on: boolean): Promise<void>
  addIdea(text: string, area: Area): Promise<void>
  updateIdea(id: string, text: string): Promise<void>
  removeIdea(id: string): Promise<void>
  addTemplateRow(input: Pick<TemplateRow, 'title' | 'owner_member_id' | 'section' | 'days_before' | 'is_running'>): Promise<void>
  updateTemplateRow(id: string, patch: Partial<Pick<TemplateRow, 'title' | 'owner_member_id' | 'section' | 'days_before' | 'is_running' | 'sort'>>): Promise<void>
  removeTemplateRow(id: string): Promise<void>

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
    effect?: EventEffect
    dropoff_by?: string | null
    dropoff_at?: string | null
    pickup_by?: string | null
    pickup_at?: string | null
  }): Promise<void>
  updateEvent(id: string, patch: Partial<Pick<Event, 'title' | 'date' | 'end_date' | 'start_time' | 'end_time' | 'member_id' | 'person_id' | 'note' | 'repeat' | 'repeat_until' | 'effect' | 'dropoff_by' | 'dropoff_at' | 'pickup_by' | 'pickup_at'>>): Promise<void>
  removeEvent(id: string): Promise<void>

  setOverride(input: { date: string; slot: Slot; value: string | null; at?: string | null; note?: string | null }): Promise<void>
  clearOverride(date: string, slot: Slot): Promise<void>
  setTemplate(input: { weekday: number; slot: Slot; value: string | null; at?: string | null; is_open: boolean; note?: string | null }): Promise<void>

  updateSettings(patch: Partial<Pick<Settings, 'dark_mode_auto' | 'briefing_time' | 'quiet_enabled' | 'quiet_hours_start' | 'quiet_hours_end' | 'show_legend' | 'workday_on' | 'mwf_notify'>>): Promise<void>

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
  const [anchors, setAnchors] = useState<Anchor[]>([])
  const [anchorLog, setAnchorLog] = useState<AnchorLog[]>([])
  const [anchorQuestions, setAnchorQuestions] = useState<AnchorQuestion[]>([])
  const [pinRows, setPinRows] = useState<AnchorPin[]>([])
  const [fairs, setFairs] = useState<Fair[]>([])
  const [template, setTemplate] = useState<TemplateRow[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])

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
          const [t, e, n, o, p, sn, an, al, aq, ap, fr, tp, id] = await Promise.all([
            store.select('tasks', { household_id: hid }),
            store.select('events', { household_id: hid }),
            store.select('normal_week', { household_id: hid }),
            store.select('week_overrides', { household_id: hid }),
            store.select('people', { household_id: hid }),
            store.select('item_seen', { member_id: mine.id }),
            store.select('anchors', { household_id: hid }),
            store.select('anchor_log', { household_id: hid }),
            store.select('anchor_questions', { household_id: hid }),
            store.select('anchor_pins', { member_id: mine.id }),
            store.select('fairs', { household_id: hid }),
            store.select('checklist_template', { household_id: hid }),
            store.select('ideas', { household_id: hid }),
          ])
          setTasks(t)
          setEvents(e)
          setNormalWeek(n)
          setOverrides(o)
          setPeople(p.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)))
          setSeen(sn)
          setAnchors(visibleAnchors(an, mine.id))
          setAnchorLog(al)
          setAnchorQuestions(aq)
          setPinRows(ap)
          setFairs(fr)
          setTemplate(tp)
          setIdeas(id)
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
        if (table === 'anchors' && me) setAnchors(visibleAnchors(await store.select('anchors', { household_id: householdId }), me.id))
        if (table === 'anchor_log') setAnchorLog(await store.select('anchor_log', { household_id: householdId }))
        if (table === 'anchor_questions') setAnchorQuestions(await store.select('anchor_questions', { household_id: householdId }))
        if (table === 'anchor_pins' && me) setPinRows(await store.select('anchor_pins', { member_id: me.id }))
        if (table === 'fairs') setFairs(await store.select('fairs', { household_id: householdId }))
        if (table === 'checklist_template') setTemplate(await store.select('checklist_template', { household_id: householdId }))
        if (table === 'ideas') setIdeas(await store.select('ideas', { household_id: householdId }))
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
      setAnchors([])
      setAnchorLog([])
      setAnchorQuestions([])
      setPinRows([])
      setFairs([])
      setTemplate([])
      setIdeas([])
      setSettings(null)
      setHousehold(null)
      return
    }
    loadRef.current()
  }, [user])

  // Live: Änderungen (auch vom anderen) nachladen
  useEffect(() => {
    if (!user) return
    const off = store.onChange(['tasks', 'events', 'normal_week', 'week_overrides', 'settings', 'members', 'people', 'item_seen', 'anchors', 'anchor_log', 'anchor_questions', 'anchor_pins', 'fairs', 'checklist_template', 'ideas'], (t) => loadRef.current(t))
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

  // MWF: fehlende Rundenpunkte der laufenden Runde anlegen (idempotent, einmal pro Tag und Sitzung)
  const generatedRef = useRef('')
  useEffect(() => {
    if (!dataReady || !me || fairs.length === 0 || template.length === 0) return
    const day = today()
    if (generatedRef.current === day) return
    generatedRef.current = day
    const run = async () => {
      if (!isDemo && supabase) {
        const { data } = await supabase.rpc('mwf_generate_rounds')
        if (typeof data === 'number' && data > 0) await loadRef.current('tasks')
        return
      }
      const fair = nextFair(fairs, day)
      if (!fair) return
      const start = roundStart(fairs, fair)
      if (day < start) return
      let n = 0
      for (const r of template.filter((x) => x.area === 'mwf')) {
        if (tasks.some((t) => t.fair_id === fair.id && t.template_id === r.id)) continue
        await store.insert('tasks', { household_id: me.household_id, area: 'mwf', title: r.title, owner_member_id: r.owner_member_id, due_date: dueFor(r, fair.date, start), status: 'offen', note: null, repeat: null, repeat_until: null, anchor_id: null, is_step: false, fair_id: fair.id, template_id: r.id, is_running: r.is_running, is_yearly: false, created_by: null, updated_by: r.owner_member_id, done_at: null })
        n++
      }
      if (n > 0) await loadRef.current('tasks')
    }
    run().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, me, fairs, template])

  // Messetage als Ereignis „Messe" (nicht gespeichert, nur abgeleitet)
  const allEvents = useMemo(() => (fairs.length ? [...events, ...fairEvents(fairs)] : events), [events, fairs])

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

  const pins = useMemo(() => new Set(pinRows.map((p) => p.anchor_id)), [pinRows])

  /** Bewegung am Anker vermerken (für „Ruht" nach 21 Tagen) */
  async function touchAnchor(id: string, patch: Partial<Anchor> = {}) {
    const { me } = need()
    await store.update('anchors', { id }, { ...patch, moved_at: new Date().toISOString(), updated_by: me.id })
  }
  async function logAnchor(id: string, kind: AnchorLogKind, text: string) {
    const { hid, me } = need()
    await store.insert('anchor_log', { household_id: hid, anchor_id: id, kind, text, author_member_id: me.id, at: new Date().toISOString() })
  }

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
    events: allEvents,
    normalWeek,
    overrides,
    seen,
    anchors,
    anchorLog,
    anchorQuestions,
    pins,
    fairs,
    template,
    ideas,
    error,

    isNew(type, item) {
      if (!me) return false
      const actor = item.updated_by ?? item.created_by
      if (!actor || actor === me.id) return false
      // Vergangene Termine nie als NEU
      const last = item.occ_end ?? item.end_date ?? item.date
      if (type === 'event' && last && last < today()) return false
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
      const row = await store.insert('tasks', { household_id: hid, created_by: me.id, updated_by: me.id, status: 'offen', note: input.note ?? null, repeat: input.repeat ?? null, repeat_until: input.repeat_until ?? null, anchor_id: input.anchor_id ?? null, is_step: input.is_step ?? false, area: input.area ?? 'casa', is_yearly: input.is_yearly ?? false, is_running: false, fair_id: null, template_id: null, ...input })
      await load('tasks')
      flushPush()
      return row
    },
    async updateTask(id, patch) {
      const { me } = need()
      // Wer eine Altlast wieder öffnet, macht sie zur normalen Aufgabe
      const cur = tasks.find((t) => t.id === id)
      const unskip = cur?.is_skipped && patch.status && patch.status !== 'erledigt' ? { is_skipped: false } : {}
      await store.update('tasks', { id }, { ...patch, ...unskip, updated_by: me.id })
      await load('tasks')
      flushPush()
    },
    async setTaskDone(id, done) {
      const { hid, me } = need()
      const status: TaskStatus = done ? 'erledigt' : 'offen'
      const doneAt = done ? new Date().toISOString() : null
      const task = tasks.find((t) => t.id === id)
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status, done_at: doneAt, is_skipped: false } : t)))
      // Altlast wird durch Antippen wieder eine normale Aufgabe
      await store.update('tasks', { id }, { status, done_at: doneAt, ...(task?.is_skipped ? { is_skipped: false } : {}), updated_by: me.id })
      // Der nächste Schritt eines Ankers: in den Verlauf, dann „Und der nächste Schritt?"
      if (task?.is_step && task.anchor_id) {
        if (done) {
          await logAnchor(task.anchor_id, 'step_done', `Erledigt: ${task.title}`)
          await touchAnchor(task.anchor_id, { ask_next: true })
        } else {
          await store.update('anchors', { id: task.anchor_id }, { ask_next: false })
        }
        await load('anchors')
        await load('anchor_log')
      }
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
            area: task.area,
            is_yearly: task.is_yearly,
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
    async takeTask(id) {
      const { me } = need()
      // updated_by = ich = neuer Besitzer, darum keine Mitteilung
      await store.update('tasks', { id }, { owner_member_id: me.id, updated_by: me.id })
      await load('tasks')
    },

    // --- Anker -------------------------------------------------------------
    async addAnchor(input) {
      const { hid, me } = need()
      const row = await store.insert('anchors', { household_id: hid, title: input.title, why: input.why, visibility: input.visibility, area: input.area ?? 'casa', phase: 'idee', notes: null, ask_next: false, moved_at: new Date().toISOString(), archived_at: null, created_by: me.id, updated_by: me.id })
      await load('anchors')
      return row
    },
    async updateAnchor(id, patch) {
      const { me } = need()
      await store.update('anchors', { id }, { ...patch, updated_by: me.id })
      await load('anchors')
    },
    async setAnchorPhase(id, phase) {
      await touchAnchor(id, { phase })
      await logAnchor(id, 'phase', `Phase: ${phaseLabel(phase)}`)
      await load('anchors')
      await load('anchor_log')
    },
    async archiveAnchor(id, archived) {
      const { me } = need()
      await store.update('anchors', { id }, { archived_at: archived ? new Date().toISOString() : null, updated_by: me.id })
      if (archived) {
        // Der offene Schritt geht mit ins Archiv
        for (const t of tasks.filter((t) => t.anchor_id === id && t.is_step && t.status !== 'erledigt')) await store.remove('tasks', { id: t.id })
        await load('tasks')
      }
      await load('anchors')
    },
    async addAnchorLog(id, kind, text) {
      await logAnchor(id, kind, text)
      await touchAnchor(id)
      await load('anchors')
      await load('anchor_log')
    },
    async setStep(anchorId, input) {
      const { hid, me } = need()
      const existing = tasks.find((t) => t.anchor_id === anchorId && t.is_step && t.status !== 'erledigt')
      if (existing) {
        await store.update('tasks', { id: existing.id }, { title: input.title, owner_member_id: input.owner_member_id, due_date: input.due_date, updated_by: me.id })
      } else {
        const area = anchors.find((a) => a.id === anchorId)?.area ?? 'casa'
        await store.insert('tasks', { household_id: hid, created_by: me.id, updated_by: me.id, status: 'offen', note: null, repeat: null, repeat_until: null, anchor_id: anchorId, is_step: true, area, is_yearly: false, is_running: false, fair_id: null, template_id: null, title: input.title, owner_member_id: input.owner_member_id, due_date: input.due_date })
      }
      await touchAnchor(anchorId, { ask_next: false })
      await load('tasks')
      await load('anchors')
      flushPush()
    },
    async addQuestion(anchorId, text) {
      const { hid, me } = need()
      const sort = anchorQuestions.filter((q) => q.anchor_id === anchorId).length
      await store.insert('anchor_questions', { household_id: hid, anchor_id: anchorId, text, resolved_at: null, sort, created_by: me.id })
      await load('anchor_questions')
    },
    async resolveQuestion(id, answer) {
      const q = anchorQuestions.find((x) => x.id === id)
      await store.update('anchor_questions', { id }, { resolved_at: new Date().toISOString() })
      if (q) {
        await logAnchor(q.anchor_id, 'question', `Geklärt: ${q.text}${answer ? ` – ${answer}` : ''}`)
        await touchAnchor(q.anchor_id)
        await load('anchors')
        await load('anchor_log')
      }
      await load('anchor_questions')
    },
    async reopenQuestion(id) {
      await store.update('anchor_questions', { id }, { resolved_at: null })
      await load('anchor_questions')
    },
    async removeQuestion(id) {
      await store.remove('anchor_questions', { id })
      await load('anchor_questions')
    },
    async setPin(anchorId, on) {
      const { me } = need()
      if (on) await store.upsert('anchor_pins', { member_id: me.id, anchor_id: anchorId }, 'member_id,anchor_id')
      else await store.remove('anchor_pins', { member_id: me.id, anchor_id: anchorId })
      await load('anchor_pins')
    },

    // --- MWF ---------------------------------------------------------------
    async setWorkday(on) {
      const { me } = need()
      await store.upsert('settings', { member_id: me.id, workday_on: on ? today() : null }, 'member_id')
      await load('settings')
    },
    async addIdea(text, area) {
      const { hid, me } = need()
      await store.insert('ideas', { household_id: hid, area, text, created_by: me.id })
      await load('ideas')
    },
    async updateIdea(id, text) {
      await store.update('ideas', { id }, { text })
      await load('ideas')
    },
    async removeIdea(id) {
      await store.remove('ideas', { id })
      await load('ideas')
    },
    async addTemplateRow(input) {
      const { hid } = need()
      const sort = template.reduce((m, r) => Math.max(m, r.sort), 0) + 1
      await store.insert('checklist_template', { household_id: hid, area: 'mwf', sort, ...input })
      await load('checklist_template')
    },
    async updateTemplateRow(id, patch) {
      await store.update('checklist_template', { id }, patch)
      await load('checklist_template')
    },
    async removeTemplateRow(id) {
      await store.remove('checklist_template', { id })
      await load('checklist_template')
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
        effect: input.effect ?? 'termin',
        dropoff_by: input.dropoff_by ?? null,
        dropoff_at: input.dropoff_at ?? null,
        pickup_by: input.pickup_by ?? null,
        pickup_at: input.pickup_at ?? null,
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

/** Private Anker nur für den Ersteller (die Datenbank filtert schon, der Demo-Modus nicht) */
function visibleAnchors(rows: Anchor[], meId: string): Anchor[] {
  return rows.filter((a) => a.visibility === 'shared' || a.created_by === meId)
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
