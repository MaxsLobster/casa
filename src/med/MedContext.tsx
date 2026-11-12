// Medikament · eigener Daten-Kontext, nur unter #/med/… eingehängt. Alles gehört einem Mitglied (RLS in der Datenbank).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCasa } from '../state/HouseholdContext'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import type { MedCheckin, MedCourse, MedDay, MedPartnerAnswer, MedSettings, MedSlot, Member } from '../lib/types'

export interface Med {
  ready: boolean
  error: string | null
  me: Member
  partner: Member | null
  /** meine Einstellungen; null = ich habe den Bereich nicht (nur die Abendfrage) */
  settings: MedSettings | null
  courses: MedCourse[]
  days: MedDay[]
  checkins: MedCheckin[]
  /** Antworten des Partners über mich */
  answers: MedPartnerAnswer[]
  /** meine eigenen Antworten über den Partner (Annas Blick) */
  myAnswers: MedPartnerAnswer[]
  /** Mitglied, das mich abends fragt */
  asking: string | null
  setTaken(date: string, time: string | null): Promise<void>
  setSleep(date: string, value: number): Promise<void>
  saveCheckin(date: string, slot: MedSlot, patch: Partial<Pick<MedCheckin, 'focus' | 'calm' | 'mood' | 'note' | 'appetite' | 'side_effects'>>): Promise<void>
  addCourse(input: { name: string | null; dose: string | null; start_date: string }): Promise<void>
  removeCourse(id: string): Promise<void>
  saveAnswer(date: string, value: number, note: string | null): Promise<void>
}

const Ctx = createContext<Med | null>(null)

export function useMed(): Med {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMed außerhalb des MedProviders')
  return c
}

export function MedProvider({ children }: { children: ReactNode }) {
  const casa = useCasa()
  const store = useMemo<Store>(() => (isDemo ? new LocalStore() : new SupabaseStore(supabase!)), [])
  const me = casa.me
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courses, setCourses] = useState<MedCourse[]>([])
  const [days, setDays] = useState<MedDay[]>([])
  const [checkins, setCheckins] = useState<MedCheckin[]>([])
  const [answers, setAnswers] = useState<MedPartnerAnswer[]>([])
  const [myAnswers, setMyAnswers] = useState<MedPartnerAnswer[]>([])

  const load = useCallback(async () => {
    if (!me) return
    try {
      const f = { member_id: me.id }
      const [c, d, k, a, mine] = await Promise.all([
        store.select('med_courses', f),
        store.select('med_days', f),
        store.select('med_checkins', f),
        store.select('med_partner_answers', { about_member_id: me.id }),
        store.select('med_partner_answers', { from_member_id: me.id }),
      ])
      setCourses(c.sort((x, y) => x.start_date.localeCompare(y.start_date) || x.created_at.localeCompare(y.created_at)))
      setDays(d)
      setCheckins(k)
      setAnswers(a)
      setMyAnswers(mine)
    } catch (err) {
      setError((err as Error).message)
    }
    setReady(true)
  }, [store, me])
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    loadRef.current()
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [me?.id])

  if (!me) return null
  const hid = me.household_id
  const fail = (err: unknown) => {
    setError((err as Error).message)
    loadRef.current()
  }

  const upsertDay = async (date: string, patch: Partial<MedDay>) => {
    const cur = days.find((d) => d.date === date)
    const row = { id: cur?.id ?? 'neu-' + date, member_id: me.id, household_id: hid, date, taken_at: cur?.taken_at ?? null, sleep: cur?.sleep ?? null, ...patch } as MedDay
    setDays((prev) => [...prev.filter((d) => d.date !== date), row])
    try {
      await store.upsert('med_days', { member_id: me.id, household_id: hid, date, ...patch }, 'member_id,date')
      setDays(await store.select('med_days', { member_id: me.id }))
    } catch (err) {
      fail(err)
    }
  }

  const med: Med = {
    ready,
    error,
    me,
    partner: casa.partner,
    settings: casa.med,
    courses,
    days,
    checkins,
    answers,
    myAnswers,
    asking: casa.medAsking,
    setTaken: (date, time) => upsertDay(date, { taken_at: time }),
    setSleep: (date, value) => upsertDay(date, { sleep: value }),
    async saveCheckin(date, slot, patch) {
      const cur = checkins.find((c) => c.date === date && c.slot === slot)
      const row = { id: cur?.id ?? `neu-${date}-${slot}`, member_id: me.id, household_id: hid, date, slot, focus: null, calm: null, mood: null, note: null, appetite: null, side_effects: [], ...cur, ...patch } as MedCheckin
      setCheckins((prev) => [...prev.filter((c) => !(c.date === date && c.slot === slot)), row])
      try {
        await store.upsert('med_checkins', { member_id: me.id, household_id: hid, date, slot, ...patch }, 'member_id,date,slot')
        setCheckins(await store.select('med_checkins', { member_id: me.id }))
      } catch (err) {
        fail(err)
      }
    },
    async addCourse(input) {
      try {
        await store.insert('med_courses', { member_id: me.id, household_id: hid, ...input })
      } catch (err) {
        setError((err as Error).message)
      }
      await loadRef.current()
    },
    async removeCourse(id) {
      try {
        await store.remove('med_courses', { id })
      } catch (err) {
        setError((err as Error).message)
      }
      await loadRef.current()
    },
    async saveAnswer(date, value, note) {
      if (!casa.medAsking) return
      const row = { household_id: hid, about_member_id: casa.medAsking, from_member_id: me.id, date, value, note }
      setMyAnswers((prev) => [...prev.filter((a) => a.date !== date), { id: 'neu-' + date, ...row }])
      try {
        await store.upsert('med_partner_answers', row, 'about_member_id,from_member_id,date')
      } catch (err) {
        fail(err)
      }
    },
  }
  return <Ctx.Provider value={med}>{children}</Ctx.Provider>
}
