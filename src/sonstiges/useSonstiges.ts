// Daten für „Sonstiges“: Hausbuch, Geschenk-Dose, Casa aufräumen (zuletzt geöffnet).
// Eigener kleiner Speicher wie bei Mila; Rechte regelt die Datenbank (RLS).
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LocalStore, SupabaseStore, type Store } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'
import { useCasa } from '../state/HouseholdContext'
import type { AreaVisit, GiftIdea, GiftPerson, HouseEntry } from '../lib/types'

let shared: Store | null = null
let demoSeed: Promise<void> | null = null
const store = () => (shared ??= isDemo ? new LocalStore() : new SupabaseStore(supabase!))

export const SECTIONS = ['Für Gäste', 'Handwerker & Firmen', 'Zähler', 'Rund ums Haus']
const START_LIST = ['Opa Hannes', 'Opa Manfred', 'Oma', 'Opa Rainer', 'Onkel Flo', 'Fabian', 'Julia', 'Kili', 'Pauli']

/** Bereiche, die sich ausblenden lassen (Casa aufräumen) */
export const AREAS: { key: string; label: string; path: string }[] = [
  { key: 'freizeit', label: 'Freizeit', path: '/freizeit' },
  { key: 'mila', label: 'Mila', path: '/mila' },
  { key: 'anker', label: 'Anker', path: '/anker' },
  { key: 'hausbuch', label: 'Hausbuch', path: '/hausbuch' },
  { key: 'geschenke', label: 'Geschenk-Dose', path: '/geschenke' },
]
/** Ab hier schreibt Casa mit, wann welcher Bereich geöffnet wurde */
export const TRACK_START = '2026-11-19'

export function useSonstiges() {
  const { household, me, members } = useCasa()
  const hid = household?.id ?? null
  const [entries, setEntries] = useState<HouseEntry[]>([])
  const [people, setPeople] = useState<GiftPerson[]>([])
  const [ideas, setIdeas] = useState<GiftIdea[]>([])
  const [visits, setVisits] = useState<AreaVisit[]>([])
  const [ready, setReady] = useState(false)

  const load = useCallback(
    async (t?: string) => {
      if (!hid) return
      const s = store()
      if (!t || t === 'house_entries') setEntries(await s.select('house_entries', { household_id: hid }))
      if (!t || t === 'gift_people') {
        // Demo: Startliste wie in der echten Datenbank (nur einmal, auch wenn mehrere Ansichten laden)
        if (isDemo) {
          demoSeed ??= (async () => {
            if ((await s.select('gift_people', { household_id: hid })).length) return
            await s.insertMany('gift_people', [
              ...START_LIST.map((name) => ({ household_id: hid, name, birthday_day: null, birthday_month: null, birth_year: null, member_id: null, note: null, archived_at: null, created_by: null })),
              ...members.filter((m) => m.role === 'partner').map((m) => ({ household_id: hid, name: m.display_name, birthday_day: null, birthday_month: null, birth_year: null, member_id: m.id, note: null, archived_at: null, created_by: null })),
            ])
          })()
          await demoSeed
        }
        const p = await s.select('gift_people', { household_id: hid })
        setPeople(p)
      }
      if (!t || t === 'gift_ideas') {
        const all = await s.select('gift_ideas', { household_id: hid })
        // Demo hat keine RLS: private Ideen anderer hier ausblenden
        const priv = new Set((await s.select('gift_people', { household_id: hid })).filter((x) => x.member_id).map((x) => x.id))
        setIdeas(isDemo ? all.filter((i) => !priv.has(i.person_id) || i.created_by === me?.id) : all)
      }
      if (!t || t === 'area_visits') setVisits(await s.select('area_visits', { household_id: hid }))
      setReady(true)
    },
    [hid, me?.id, members],
  )

  useEffect(() => {
    void load()
    const off = store().onChange(['house_entries', 'gift_people', 'gift_ideas', 'area_visits'], (t) => void load(t))
    return off
  }, [load])

  const need = () => {
    if (!hid || !me) throw new Error('Nicht angemeldet')
    return { hid, me }
  }

  return {
    ready,
    entries: [...entries].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    people: people.filter((p) => !p.archived_at),
    ideas: [...ideas].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    visits,

    async saveEntry(e: Partial<HouseEntry> & { title: string; section: string }) {
      const { hid, me } = need()
      const row = { section: e.section.trim() || 'Rund ums Haus', title: e.title.trim(), value: e.value?.trim() || null, date: e.date || null, note: e.note?.trim() || null, hidden: !!e.hidden, updated_by: me.id }
      if (e.id) await store().update('house_entries', { id: e.id }, row)
      else await store().insert('house_entries', { household_id: hid, created_by: me.id, position: Date.now() % 1e9, ...row })
      await load('house_entries')
    },
    async removeEntry(id: string) {
      await store().remove('house_entries', { id })
      await load('house_entries')
    },

    async savePerson(p: Partial<GiftPerson> & { name: string }) {
      const { hid, me } = need()
      const row = { name: p.name.trim(), birthday_day: p.birthday_day ?? null, birthday_month: p.birthday_month ?? null, birth_year: p.birth_year ?? null, note: p.note ?? null }
      if (p.id) await store().update('gift_people', { id: p.id }, row)
      else await store().insert('gift_people', { household_id: hid, created_by: me.id, member_id: null, archived_at: null, ...row })
      await load('gift_people')
    },
    async archivePerson(id: string) {
      await store().update('gift_people', { id }, { archived_at: new Date().toISOString() })
      await load('gift_people')
    },
    async addIdea(personId: string, text: string) {
      const { hid, me } = need()
      await store().insert('gift_ideas', { household_id: hid, person_id: personId, text: text.trim(), done_at: null, created_by: me.id })
      await load('gift_ideas')
    },
    async setIdeaDone(id: string, done: boolean) {
      await store().update('gift_ideas', { id }, { done_at: done ? new Date().toISOString() : null })
      await load('gift_ideas')
    },
    async removeIdea(id: string) {
      await store().remove('gift_ideas', { id })
      await load('gift_ideas')
    },
  }
}

// ---------------------------------------------------------------------------
// Geburtstage
// ---------------------------------------------------------------------------
/** Nächster Geburtstag ab heute (ISO) oder null */
export function nextBirthday(p: GiftPerson, today: string): string | null {
  if (!p.birthday_day || !p.birthday_month) return null
  const y = Number(today.slice(0, 4))
  const at = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    const day = p.birthday_month === 2 && p.birthday_day === 29 && !leap ? 28 : p.birthday_day!
    return `${year}-${String(p.birthday_month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const d = at(y)
  return d >= today ? d : at(y + 1)
}
export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000)
}
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export function birthdayLabel(p: GiftPerson, today: string): string {
  const n = nextBirthday(p, today)
  if (!n) return 'Geburtstag fehlt'
  const d = daysUntil(n, today)
  if (d === 0) return 'heute Geburtstag'
  if (d === 1) return 'morgen'
  if (d <= 31) return `in ${d} Tagen`
  return `${p.birthday_day}. ${MONTHS[p.birthday_month! - 1]}`
}

// ---------------------------------------------------------------------------
// Bereiche: zuletzt geöffnet (pro Person, höchstens alle 6 Stunden geschrieben)
// ---------------------------------------------------------------------------
export function useAreaTracking() {
  const { pathname } = useLocation()
  const { household, me } = useCasa()
  useEffect(() => {
    const area = AREAS.find((a) => pathname === a.path || pathname.startsWith(a.path + '/'))
    if (!area || !household || !me) return
    const k = `casa.area.${me.id}.${area.key}`
    try {
      const last = Number(localStorage.getItem(k) ?? 0)
      if (Date.now() - last < 6 * 3600 * 1000) return
      localStorage.setItem(k, String(Date.now()))
    } catch {
      /* privat: trotzdem schreiben */
    }
    void store()
      .upsert('area_visits', { member_id: me.id, household_id: household.id, area: area.key, last_at: new Date().toISOString() }, 'member_id,area')
      .catch(() => undefined)
  }, [pathname, household, me])
}

/** Bereiche, die seit 30 Tagen niemand geöffnet hat (erst, wenn Casa 30 Tage mitgeschrieben hat) */
export function unusedAreas(visits: AreaVisit[], hidden: string[], today: string) {
  const cutoff = Date.parse(today + 'T12:00:00Z') - 30 * 86400000
  const tracking = Date.parse(TRACK_START + 'T00:00:00Z') <= cutoff
  return AREAS.filter((a) => !hidden.includes(a.key)).map((a) => {
    const last = visits.filter((v) => v.area === a.key).map((v) => v.last_at).sort().pop() ?? null
    return { ...a, last, unused: tracking && (!last || Date.parse(last) < cutoff) }
  })
}
