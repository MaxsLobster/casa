import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, dayLabel, eventEnd, fromISO, hhmm, spanLabel, startOfWeek, uhr, weekdayLong, weekdayShort } from '../lib/dates'
import { dayState, name as whoName, verb, type Voice } from '../lib/week'
import { applyEffects, awayOn, dayEffects, isEffectEvent, openChips } from '../lib/effects'
import { sunTimes } from '../lib/daily'
import { isMultiDay, occurrences, type Occurrence } from '../lib/recur'
import { toH } from '../lib/band'
import { Check, Sheet } from '../components/ui'
import { dayWord, daySegments, segText, valerieDay, askText } from '../lib/day'
import { GehtNix } from './GehtNix'
import { SonstigesSheet } from '../sonstiges/Sonstiges'
import type { Event, Slot, SlotRequest, Task } from '../lib/types'
import { wantsStagger } from '../state/splash'
import { PotIcon } from '../mila/icons'
import { Takeover } from './Takeover'
import { EventEditor } from './EventEditor'
import { SlotEditor } from './SlotEditor'
import { TaskEditor } from './TaskEditor'
import { isResting } from '../lib/anchors'
import { isFairEvent, isShared, isWorkday, unreadShouts } from '../lib/mwf'
import { MwfIcon } from '../mwf/MwfIcon'
import { isMilaEvent, mealsOn } from '../mila/casa-link'
import { minutes } from '../mila/rhythm'
import { alarmOpen } from '../lib/freizeit'
import { heuteDran, itemsOfWeek } from '../mila/wahl'
import { shortName } from '../mila/engine'

/** Wischen: erst bei deutlicher Bewegung zur Seite, damit Scrollen nicht stört */
const SWIPE_MIN = 60
const SLIDE_MS = 180

interface Row {
  key: string
  sort: number
  time: string | null // „18:00" oder null (Gold-Punkt)
  kind: 'event' | 'task' | 'valerie' | 'plan'
  title: string
  sub: string
  task?: Task
  isNew?: boolean
  /** gehört zu einem Anker */
  anchor?: string | null
  /** Arbeit (MWF) */
  mwf?: boolean
  /** Antippen: Ereignis/Termin bearbeiten, Abweichung für den Tag, Aufgabe bearbeiten */
  event?: string // base_id
  slots?: Slot[]
  /** Antippen öffnet diese Seite (z. B. Kochmodus) */
  link?: string
}

type Slide = null | 'out-left' | 'out-right' | 'enter-left' | 'enter-right'

export function Heute() {
  const casa = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const location = useLocation()
  const { me, partner, members, people, tasks: allTasks, events, normalWeek, overrides, anchors: allAnchors, pins, settings, setTaskDone, takeTask, isNew, markSeen, freizeitTipps, slotRequests } = casa
  const freizeitNeu = freizeitTipps.some((t) => alarmOpen(t, today))
  // Casa zeigt nur den Bereich casa; bei Arbeitstag an zusätzlich meine heute fälligen MWF-Aufgaben
  const workday = isWorkday(settings, today)
  const hasShouts = unreadShouts(casa.shouts, me?.id ?? null).length > 0
  const tasks = useMemo(() => allTasks.filter((t) => t.area === 'casa' || (workday && (t.owner_member_id === me?.id || isShared(t)) && t.due_date === today && !t.is_running)), [allTasks, workday, me?.id, today])
  const anchors = useMemo(() => allAnchors.filter((a) => a.area === 'casa'), [allAnchors])
  const anchorName = (id: string | null) => (id ? anchors.find((a) => a.id === id)?.title ?? null : null)
  const voice: Voice = { me, members }

  // ---------- Tag: heute oder (per Wischen) ein späterer Tag ----------
  const [offset, setOffset] = useState(0)
  const [slide, setSlide] = useState<Slide>(null)
  const busyRef = useRef(false)
  const date = addDays(today, offset)
  const isToday = offset === 0
  // Beim Öffnen und beim Tippen auf „Heute" in der Leiste: immer heute
  useEffect(() => {
    setOffset(0)
    setSlide(null)
  }, [location.key])

  const go = useCallback(
    (dir: 1 | -1) => {
      if (busyRef.current) return
      setOffset((o) => {
        const next = o + dir
        if (next < 0) return o
        busyRef.current = true
        setSlide(dir > 0 ? 'out-left' : 'out-right')
        window.setTimeout(() => {
          setOffset(next)
          setSlide(dir > 0 ? 'enter-left' : 'enter-right')
          // Kurz warten, bis die Startposition gezeichnet ist, dann hereinschieben
          window.setTimeout(() => {
            setSlide(null)
            window.setTimeout(() => {
              busyRef.current = false
            }, SLIDE_MS)
          }, 30)
        }, SLIDE_MS)
        return o
      })
    },
    [],
  )
  // Zurück zu heute: alle Tage auf einmal, nicht einzeln
  function backToToday() {
    if (offset === 0 || busyRef.current) return
    busyRef.current = true
    setSlide('out-right')
    window.setTimeout(() => {
      setOffset(0)
      setSlide('enter-right')
      window.setTimeout(() => {
        setSlide(null)
        window.setTimeout(() => {
          busyRef.current = false
        }, SLIDE_MS)
      }, 30)
    }, SLIDE_MS)
  }

  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return
    go(dx < 0 ? 1 : -1)
  }

  // Kaltstart: Zeilen erscheinen nacheinander (siehe state/splash.ts). Danach Klassen wieder weg.
  const [stagger, setStagger] = useState(wantsStagger)
  useEffect(() => {
    if (!stagger) return
    const t = window.setTimeout(() => setStagger(false), 1800)
    return () => window.clearTimeout(t)
  }, [stagger])
  const rc = stagger ? ' rise' : ''
  const rs = (i: number): CSSProperties | undefined => (stagger ? ({ '--i': Math.min(i, 9) } as CSSProperties) : undefined)

  // ---------- Kopf ----------
  const d = fromISO(date)
  const sun = useMemo(() => sunTimes(date), [date])

  // ---------- Was an dem Tag gilt ----------
  const occDay = useMemo(() => occurrences(events, date, date).filter((o) => o.occ_date <= date && o.occ_end >= date), [events, date])
  const fx = useMemo(() => dayEffects(date, occDay, members), [date, occDay, members])
  const day = useMemo(() => applyEffects(dayState(date, normalWeek, overrides), fx), [date, normalWeek, overrides, fx])
  // Heute: nur, was noch kommt. Anderer Tag: der ganze Tag.
  const nowH = isToday ? now.getHours() + now.getMinutes() / 60 : -1
  const [takeover, setTakeover] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [editSlots, setEditSlots] = useState<Slot[] | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [nix, setNix] = useState(false)
  const hiddenAreas = settings?.hidden_areas ?? []
  // Zahnrad → Blatt „Sonstiges“ (auch beim Zurück aus Hausbuch und Co.)
  const [sonst, setSonst] = useState(() => !!(location.state as { sonstiges?: boolean } | null)?.sonstiges)
  useEffect(() => {
    if ((location.state as { sonstiges?: boolean } | null)?.sonstiges) setSonst(true)
  }, [location.state])
  const [undoNix, setUndoNix] = useState<{ n: number; run: () => Promise<void> } | null>(null)
  useEffect(() => {
    if (!undoNix) return
    const t = window.setTimeout(() => setUndoNix(null), 15000)
    return () => window.clearTimeout(t)
  }, [undoNix])
  const present = (slots: Slot[]) => slots.filter((x) => day[x])

  const whoEvent = (o: Occurrence) => {
    if (o.person_id) return people.find((p) => p.id === o.person_id)?.name ?? ''
    if (!o.member_id) return 'ihr beide'
    if (o.member_id === me?.id) return 'du'
    return members.find((m) => m.id === o.member_id)?.display_name ?? ''
  }

  const rows: Row[] = []
  // Valerie (Bringen, Holen, Ausnahmen) steht in der Tageskarte oben, nicht mehr in der Liste
  if (fx.messe) {
    rows.push({ key: 'fxm', sort: -1, time: null, kind: 'plan', title: 'Messe', sub: 'Munich Watch Fair · ihr seid beide weg', event: fx.messe.base_id })
  }
  for (const a of fx.away) {
    if (a.occ.effect === 'messe') continue
    rows.push({ key: 'fxa' + a.member.id, sort: -1, time: null, kind: 'plan', title: a.member.id === me?.id ? 'Du bist weg' : `${a.member.display_name} ist weg`, sub: spanLabel(a.occ.occ_date, a.occ.occ_end), isNew: isNew('event', a.occ), event: a.occ.base_id })
  }
  // Termine, heute nur die noch nicht vorbei sind
  for (const o of occDay) {
    if (isMultiDay(o) || isEffectEvent(o)) continue
    if (isToday && eventEnd({ date, start_time: o.start_time, end_time: o.end_time }) <= now) continue
    const parts = [whoEvent(o)]
    if (o.end_time) parts.push(`bis ${uhr(o.end_time)}`)
    rows.push({ key: 'e' + o.id + o.occ_date, sort: o.start_time ? toH(o.start_time, 0) : -1, time: o.start_time ? hhmm(o.start_time) : null, kind: 'event', title: o.title + (o.is_repeat || o.repeat ? ' ↻' : ''), sub: parts.join(' · '), isNew: isNew('event', o), event: o.base_id })
  }
  const nm = day.nachmittag
  if (nm?.value && nowH < 18) rows.push({ key: 'nm', sort: 15, time: null, kind: 'plan', title: nm.value, sub: 'Nachmittag', slots: ['nachmittag'] })
  // Mila: Gericht am Abend und Mittag; Antippen öffnet den Kochmodus
  const meals = mealsOn(casa.milaDays, date)
  const dinner = meals.abend ? casa.milaRecipe(meals.abend.recipe_id) : null
  const lunch = meals.mittag ? casa.milaRecipe(meals.mittag.recipe_id) : null
  // Antippen öffnet die Rezeptkarte dieses Tages (Kochen geht von dort)
  const cardLink = (id: string, meal: 'mittag' | 'abend') => `/mila/rezept/${id}?tag=${date}&m=${meal}`
  if (lunch && meals.mittag && nowH < 14) {
    const left = meals.mittag.is_leftover
    rows.push({ key: 'mm', sort: 12, time: null, kind: 'plan', title: left ? `Mittag: Reste vom ${shortName(lunch.name)}` : `Mittag: ${lunch.name}`, sub: left ? 'aufwärmen' : 'aus der Box', link: cardLink(lunch.id, 'mittag') })
  }
  const es = day.abend_essen
  if (es?.value && !es.is_open && nowH < 19.5) {
    const person = isPersonName(es.value, members, people)
    const who = person ? cap(verb(es.value, voice, 'kochst', 'kocht')) : `Essen ${es.value}`
    if (dinner) rows.push({ key: 'es', sort: 18.5, time: null, kind: 'plan', title: `${who}: ${dinner.name}`, sub: ['Abend', minutes(dinner.time_min)].filter(Boolean).join(' · '), link: cardLink(dinner.id, 'abend') })
    else rows.push({ key: 'es', sort: 18.5, time: null, kind: 'plan', title: who, sub: 'Abend', slots: present(['abend_essen', 'abend_bett']) })
  } else if (dinner && nowH < 19.5) {
    rows.push({ key: 'es', sort: 18.5, time: null, kind: 'plan', title: dinner.name, sub: ['Abend', minutes(dinner.time_min), 'wer kocht? offen'].filter(Boolean).join(' · '), link: cardLink(dinner.id, 'abend') })
  }  // Wochenwahl: noch nichts für heute Abend eingetragen → Milas Vorschlag aus der Kombo
  // Abend als „Reste“, „auswärts“ oder „frei“ markiert: dann schlägt Mila nichts vor, die Zeile sagt es
  const dayMark = casa.milaDays.find((w) => w.date === date && (w.meal ?? 'abend') === 'abend' && !w.recipe_id && w.free_text)?.free_text ?? null
  if (dayMark && nowH < 19.5) rows.push({ key: 'mk', sort: 18.4, time: null, kind: 'plan', title: dayMark === 'Reste' ? 'Heute Abend: Reste' : dayMark === 'auswärts' ? 'Heute Abend: auswärts essen' : 'Heute Abend: nichts geplant', sub: 'Essensplan', link: '/mila/woche' })
  const suggest = !dinner && !dayMark && isToday && nowH < 19.5 ? heuteDran(itemsOfWeek(casa.milaPlan, casa.milaPlanItems, date), date).abend : null
  const suggestR = suggest && suggest.status === 'offen' ? casa.milaRecipe(suggest.recipe_id) : null
  if (suggestR) rows.push({ key: 'ms', sort: 18.5, time: null, kind: 'plan', title: `Mila schlägt vor: ${suggestR.name}`, sub: ['Abend', minutes(suggestR.time_min)].filter(Boolean).join(' · '), link: '/mila/heute' })

  const bt = day.abend_bett
  if (bt?.value && !bt.is_open && nowH < 20.5) rows.push({ key: 'bt', sort: 19.5, time: null, kind: 'plan', title: cap(verb(bt.value, voice, 'bringst ins Bett', 'bringt ins Bett')), sub: 'Abend', slots: present(['abend_essen', 'abend_bett']) })
  const we = day.wochenende
  if (we?.value && !we.is_open && nowH < 20) rows.push({ key: 'we', sort: 9, time: null, kind: 'plan', title: we.value, sub: 'Wochenende', slots: ['wochenende'] })
  // Meine Aufgaben an dem Tag stehen in der Tageskarte oben
  const dayTasks = tasks.filter((t) => t.status !== 'erledigt' && t.due_date === date && (t.owner_member_id === me?.id || isShared(t)))
  const taskSub = (t: Task) => {
    const away = !!t.owner_member_id && (t.area === 'mwf' ? awayOn(events, t.owner_member_id, date, 'mwf') : fx.away.some((a) => a.member.id === t.owner_member_id))
    return away ? 'Du bist weg – trotzdem bei dir lassen?' : isShared(t) ? 'beide' : ''
  }
  rows.sort((a, c) => a.sort - c.sort)
  const chips = isToday ? [] : openChips(day, fx)
  // Offene Aufgaben (noch niemand): heute fällig oder überfällig, an anderen Tagen genau an dem Tag
  const openTasks = tasks.filter((t) => t.area === 'casa' && t.status !== 'erledigt' && t.owner_member_id === null && (isToday ? t.due_date <= today : t.due_date === date)).sort((a, c) => a.due_date.localeCompare(c.due_date))
  // Meine gepinnten Anker (nur heute)
  const pinned = isToday ? anchors.filter((a) => pins.has(a.id) && !a.archived_at).sort((a, c) => a.title.localeCompare(c.title)) : []

  // ---------- Tageskarte: wer hat Valerie, meine Aufgaben, ab 17 Uhr „Morgen · Fr“ ----------
  const vd = valerieDay(date, day, fx, voice, people, slotRequests)
  const myDeclined = (slot: string) => slotRequests.filter((r) => r.date === date && r.slot === slot && r.from_member_id === me?.id && r.status === 'abgelehnt').sort((a, c) => (c.answered_at ?? '').localeCompare(a.answered_at ?? ''))[0] ?? null
  const tomorrow = addDays(today, 1)
  const showTomorrow = isToday && now.getHours() >= 17
  const tomorrowLine = useMemo(() => {
    if (!showTomorrow) return ''
    const occT = occurrences(events, tomorrow, tomorrow).filter((o) => o.occ_date <= tomorrow && o.occ_end >= tomorrow)
    const fxT = dayEffects(tomorrow, occT, members)
    const stT = applyEffects(dayState(tomorrow, normalWeek, overrides), fxT)
    const segs = daySegments(tomorrow, stT, fxT, { me, members }, people, slotRequests)
    const termine = occT.filter((o) => !isMultiDay(o) && !isEffectEvent(o) && (o.member_id === null || o.member_id === me?.id)).sort((a, c) => (a.start_time ?? '').localeCompare(c.start_time ?? '')).slice(0, 2).map((o) => (o.start_time ? `${o.title} ${hhmm(o.start_time)}` : o.title))
    return [segText(segs), ...termine].filter(Boolean).join(' · ')
  }, [showTomorrow, events, tomorrow, members, normalWeek, overrides, me, people, slotRequests])
  const [asking, setAsking] = useState<string | null>(null)
  async function ask(slot: Slot, at: string | null) {
    setAsking(slot)
    try {
      await casa.askHandover({ date, slot, at })
    } finally {
      setAsking(null)
    }
  }

  // ---------- Das braucht deine Antwort (nur heute) ----------
  const toAnswer: SlotRequest[] = isToday ? slotRequests.filter((r) => r.to_member_id === me?.id && r.status === 'offen' && r.date >= today).sort((a, c) => a.date.localeCompare(c.date)) : []
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const toAccept: Task[] = isToday ? allTasks.filter((t) => t.area === 'casa' && t.owner_member_id === me?.id && t.status === 'offen' && !!t.created_by && t.created_by !== me?.id && t.created_at >= weekAgo && !t.is_step) : []
  const answerCount = toAnswer.length + toAccept.length
  const [answers, setAnswers] = useState(false)

  // ---------- Überfälliges (nur heute, ruhig gesammelt) ----------
  const overdue: Task[] = isToday ? tasks.filter((t) => t.area === 'casa' && t.status !== 'erledigt' && !t.is_running && t.due_date < today && (t.owner_member_id === me?.id || isShared(t))).sort((a, c) => a.due_date.localeCompare(c.due_date)) : []
  const overdueLabel = overdue.length === 0 ? '' : `${overdue.length} ${overdue.every((t) => t.due_date < startOfWeek(today)) ? 'von letzter Woche' : overdue.length === 1 ? 'liegt noch' : 'liegen noch'}`
  const [showOverdue, setShowOverdue] = useState(false)
  const quietDay = rows.length === 0 && chips.length === 0 && openTasks.length === 0 && dayTasks.length === 0 && overdue.length === 0 && answerCount === 0

  // ---------- Demnächst (nur heute) ----------
  const soon = useMemo(() => {
    const to = addDays(today, 7)
    // Laufende Wirkungs-Ereignisse stehen schon unter „Heute noch"; „Kita zu" ist Hintergrundwissen
    return occurrences(events, today, to).filter((o) => isMultiDay(o) && o.occ_end >= today && o.effect !== 'kita_zu' && !(isEffectEvent(o) && o.occ_date <= today))
  }, [events, today])

  // ---------- Neu von … ----------
  const newTasks = tasks.filter((t) => t.owner_member_id === me?.id && t.status !== 'erledigt' && isNew('task', t))
  const newEvents = events.filter((e) => (e.member_id === null || e.member_id === me?.id) && isNew('event', e))
  const newItems = [
    ...newTasks.map((t) => ({ kind: 'task' as const, date: t.due_date, title: t.title })),
    ...newEvents.map((e) => ({ kind: 'event' as const, date: e.date, title: e.title })),
  ].sort((a, c) => a.date.localeCompare(c.date))
  const newCount = newItems.length
  const firstNew = newItems[0] ? `${newItems[0].title} · ${dayLabel(newItems[0].date)}` : ''
  function openNew() {
    const first = newItems[0]
    void markSeen('task', newTasks.map((t) => t.id))
    void markSeen('event', newEvents.map((e) => e.id))
    if (first?.kind === 'event') nav('/woche', { state: { date: first.date } })
    else nav('/todos')
  }

  const slideCls = slide ? ` heute--${slide}` : ''

  return (
    <div className={'page heute' + slideCls} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button type="button" className="heute__gear" aria-label="Sonstiges und Einstellungen" onClick={() => setSonst(true)}>
        <GearIcon />
      </button>
      {!hiddenAreas.includes('mila') && (
        <Link to="/mila/start" className="heute__gear heute__pot" aria-label="Mila, der Essensplaner">
          <PotIcon />
        </Link>
      )}
      {!hiddenAreas.includes('freizeit') && (
      <Link to="/freizeit" className={'heute__gear heute__frei' + (hiddenAreas.includes('mila') ? ' heute__gear--s1' : '')} aria-label="Freizeit">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 19.5l6-9 4 5.5 2.5-3 6.5 6.5z" />
          <circle cx="17" cy="6.5" r="2.3" />
        </svg>
        {freizeitNeu && <span className="mwf__dot mwf__dot--icon" style={{ top: 9, right: 9 }} aria-label="neue Tipps" />}
      </Link>
      )}
      {casa.med?.enabled && (
        <Link to="/med" className="heute__gear heute__med" aria-label="Medikament">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
            <path d="M9.5 9.5l5 5" />
          </svg>
        </Link>
      )}
      {workday && (
        <Link to="/mwf/hub" className="heute__gear heute__mwf" style={casa.med?.enabled ? { right: 178 } : undefined} aria-label="Munich Watch Fair">
          <MwfIcon />
          {hasShouts && <span className="mwf__dot mwf__dot--icon" aria-label="ungelesene Zurufe" />}
        </Link>
      )}
      {/* ---------- Kopf ---------- */}
      <div className="heute__head">
        {!isToday && (
          <button type="button" className="heute__back" onClick={backToToday}>← zurück zu heute</button>
        )}
        <div className={'heute__date' + rc} style={rs(0)}>
          <button type="button" className="heute__num" onClick={backToToday} aria-label={isToday ? undefined : 'Zurück zu heute'} style={isToday ? { cursor: 'default' } : undefined}>{d.getDate()}</button>
          <div className="stack" style={{ gap: 2, paddingBottom: 4 }}>
            <span className="heute__wd">{weekdayLong(date)}</span>
          </div>
        </div>
        <div className={'heute__tear' + rc} style={rs(1)} />
        <div className={'heute__info' + rc} style={rs(2)}>
          <span className="heute__sun" title="Sonnenaufgang – Sonnenuntergang">
            <SunIcon />
            {sun.sunrise}–{sun.sunset}
          </span>
        </div>
      </div>

      {/* ---------- Inhalt + Zeitstrahl ---------- */}
      <div className="heute__body">
        <div className="heute__left">
          {answerCount > 0 && (
            <button type="button" className={'heute__answer' + rc} style={rs(3)} onClick={() => setAnswers(true)}>
              <span className="heute__answer-dot" aria-hidden />
              <span>Das braucht deine Antwort</span>
              <span className="heute__answer-n">{answerCount}</span>
            </button>
          )}

          {isToday && fromISO(today).getDay() === 0 && now.getHours() >= 16 && !hiddenAreas.includes('anker') && (
            <button type="button" className={'heute__runde' + rc} style={rs(3)} onClick={() => nav('/anker/runde')}>
              <span aria-hidden>⚓︎</span>
              <span>Sonntagsrunde · 5 Minuten</span>
              <span className="heute__answer-n" aria-hidden>›</span>
            </button>
          )}

          {/* ---------- Tageskarte ---------- */}
          <section className={'daycard' + rc} style={rs(3)} aria-label="Der Tag auf einen Blick">
            {vd.headline ? (
              <div className="daycard__row">
                <span className="daycard__k">Valerie</span>
                <button type="button" className={'daycard__v' + (vd.needsWho ? ' daycard__v--open' : ' daycard__v--changed')} onClick={() => {
                  const id = fx.kitaZu?.base_id ?? fx.valerieWeg?.base_id
                  const ev = id ? events.find((x) => x.id === id) ?? null : null
                  if (vd.needsWho) setTakeover(true)
                  else if (ev) setEditEvent(ev)
                }}>{vd.headline}</button>
              </div>
            ) : (
              vd.rows.map((r) => {
                const declined = !r.request && r.mine ? myDeclined(r.slot) : null
                return (
                  <div className="daycard__row" key={r.slot}>
                    <span className="daycard__k">{r.label}</span>
                    <button type="button" className={'daycard__v' + (r.open || r.request ? ' daycard__v--open' : r.changed ? ' daycard__v--changed' : '')} onClick={() => (r.open ? setTakeover(true) : setEditSlots(['valerie_bringen', 'valerie_holen'].filter((x) => day[x as Slot]) as Slot[]))}>
                      {r.request ? `offen · ${askText(r.request, voice)}` : r.text}
                      {r.at && !r.request && <span className="daycard__at">{hhmm(r.at)}</span>}
                    </button>
                    {r.mine && !r.request && date >= today && partner && (
                      <button type="button" className="daycard__ask" disabled={asking === r.slot} onClick={() => void ask(r.slot, r.at)}>Kannst du übernehmen?</button>
                    )}
                    {r.request && r.request.from_member_id === me?.id && (
                      <button type="button" className="daycard__ask daycard__ask--quiet" onClick={() => void casa.withdrawRequest(r.request!.id)}>zurückziehen</button>
                    )}
                    {declined && <span className="daycard__note">{partner?.display_name ?? 'Der andere'} kann nicht</span>}
                  </div>
                )
              })
            )}
            {vd.needsWho && fx.kitaZu && partner && (
              <div className="daycard__chips">
                <button type="button" className="wk__chip" onClick={() => void casa.setOverride({ date, slot: 'valerie_tag', value: me?.display_name ?? null })}>Ich hab sie</button>
                <button type="button" className="wk__chip" onClick={() => void casa.setOverride({ date, slot: 'valerie_tag', value: partner.display_name })}>{partner.display_name} hat sie</button>
                <button type="button" className="wk__chip" onClick={() => void casa.setOverride({ date, slot: 'valerie_tag', value: 'beide' })}>beide</button>
              </div>
            )}
            {!vd.headline && vd.rows.length === 0 && dayTasks.length === 0 && <span className="daycard__empty">Kein Kita-Tag</span>}
            {dayTasks.map((t) => (
              <div className="daycard__task" key={t.id}>
                <Check done={false} onToggle={() => setTaskDone(t.id, true)} label={`${t.title} abhaken`} />
                <button type="button" className="heute__tap" onClick={() => setEditTask(t)}>
                  <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                    <span className="hand hand--navy" style={{ lineHeight: 1.1 }}>
                      {t.title}
                      {isNew('task', t) && <span className="stamp stamp--new" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Neu</span>}
                    </span>
                    {(taskSub(t) || t.anchor_id || t.area === 'mwf') && (
                      <span className="heute__sub">
                        {t.area === 'mwf' && <span className="mwf__tag" style={{ marginRight: 8 }}>MWF</span>}
                        {taskSub(t)}
                        {anchorName(t.anchor_id) && <span className="ank__tag" style={{ marginLeft: taskSub(t) ? 8 : 0 }}>{anchorName(t.anchor_id)}</span>}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            ))}
            {showTomorrow && tomorrowLine && (
              <button type="button" className="daycard__tomorrow" onClick={() => go(1)}>
                <span className="daycard__k">{dayWord(tomorrow, today)}</span>
                <span className="daycard__tline">{tomorrowLine}</span>
              </button>
            )}
          </section>

          {overdue.length > 0 && (
            <section className={'heute__overdue' + rc} style={rs(4)}>
              <button type="button" className="heute__overdue-head" onClick={() => setShowOverdue((v) => !v)} aria-expanded={showOverdue}>
                <span>{overdueLabel}</span>
                <span className="heute__overdue-arrow" aria-hidden>{showOverdue ? '▾' : '▸'}</span>
              </button>
              {showOverdue && overdue.map((t) => (
                <div className="daycard__task" key={t.id}>
                  <Check done={false} onToggle={() => setTaskDone(t.id, true)} label={`${t.title} abhaken`} />
                  <button type="button" className="heute__tap" onClick={() => setEditTask(t)}>
                    <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                      <span className="hand hand--navy" style={{ lineHeight: 1.1 }}>{t.title}</span>
                      <span className="heute__sub">seit {t.due_date >= startOfWeek(today) ? weekdayShort(t.due_date) : dayLabel(t.due_date)}</span>
                    </span>
                  </button>
                </div>
              ))}
            </section>
          )}

          {isToday && newCount > 0 && (
            <button type="button" className={'note heute__note' + rc} onClick={openNew} style={{ textAlign: 'left', width: '100%', cursor: 'pointer', ...rs(3) }}>
              <span className="label label--small" style={{ color: 'var(--brown)' }}>Neu von {partner?.display_name ?? 'Anna'}</span>
              <span className="hand" style={{ fontSize: 25, lineHeight: 1.15 }}>
                {firstNew}
                {newCount > 1 && <span className="hand hand--meta" style={{ marginLeft: 8 }}>+{newCount - 1} weitere</span>}
              </span>
            </button>
          )}

          <section className="stack" style={{ gap: 12 }}>
            <h2 className={'heute__h2' + rc} style={rs(4)}>{isToday ? 'Heute noch' : 'An diesem Tag'}</h2>
            {rows.length > 0 || chips.length > 0 || openTasks.length > 0 ? null : quietDay ? <p className={'hint' + rc} style={rs(5)}>{isToday ? 'Nichts mehr für heute. Schön.' : 'Nichts eingetragen.'}</p> : <p className={'hint' + rc} style={rs(5)}>{isToday ? 'Sonst nichts mehr.' : 'Sonst nichts.'}</p>}
            {rows.map((r, idx) => {
              const open = () => {
                if (r.link) nav(r.link)
                else if (r.task) setEditTask(r.task)
                else if (r.event) {
                  const ev = events.find((x) => x.id === r.event) ?? null
                  if (ev && isFairEvent(ev)) nav('/mwf/hub')
                  else if (ev && isMilaEvent(ev)) nav('/mila/prep')
                  else if (ev && freizeitTipps.some((t) => t.event_id === ev.id)) nav('/freizeit?tipp=' + freizeitTipps.find((t) => t.event_id === ev.id)!.id)
                  else setEditEvent(ev)
                } else if (r.slots?.length) setEditSlots(r.slots)
              }
              const text = (
                <div className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                  <span className="hand hand--navy" style={{ lineHeight: 1.1 }}>
                    {r.title}
                    {r.isNew && <span className="stamp stamp--new" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Neu</span>}
                  </span>
                  {(r.sub || r.anchor || r.mwf) && (
                    <span className="heute__sub">
                      {r.mwf && <span className="mwf__tag" style={{ marginRight: r.sub || r.anchor ? 8 : 0 }}>MWF</span>}
                      {r.sub}
                      {r.anchor && <span className="ank__tag" style={{ marginLeft: r.sub ? 8 : 0 }}>{r.anchor}</span>}
                    </span>
                  )}
                </div>
              )
              return (
                <div className={'heute__row' + rc} style={rs(5 + idx)} key={r.key}>
                  {r.kind === 'task' && r.task ? (
                    <>
                      <span className="heute__time">
                        <span style={{ transform: 'scale(0.8)', transformOrigin: 'center', marginLeft: 10 }}>
                          <Check done={false} onToggle={() => setTaskDone(r.task!.id, true)} label={`${r.title} abhaken`} />
                        </span>
                      </span>
                      <button type="button" className="heute__tap" onClick={open}>{text}</button>
                    </>
                  ) : (
                    <button type="button" className="heute__tap" onClick={open}>
                      <span className="heute__time">{r.time ? r.time : <span className={'heute__dot' + (r.kind === 'valerie' ? ' heute__dot--gold' : '')} />}</span>
                      {text}
                    </button>
                  )}
                </div>
              )
            })}
            {(chips.length > 0 || openTasks.length > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chips.map((c) => (
                  <button key={c.key} type="button" className="wk__chip" onClick={() => setTakeover(true)}>{c.label}</button>
                ))}
                {openTasks.map((t) => (
                  <button key={t.id} type="button" className="wk__chip" onClick={() => takeTask(t.id)} aria-label={`${t.title} übernehmen`}>
                    {t.title}{t.due_date < today ? ` · seit ${dayLabel(t.due_date)}` : ''} · übernehmen
                  </button>
                ))}
              </div>
            )}
            {isToday && (
              <button type="button" className="heute__nix" onClick={() => setNix(true)}>☾ heute geht nix</button>
            )}
          </section>

          {isToday && soon.length > 0 && (
            <section className={'stack' + rc} style={{ gap: 8, ...rs(5 + rows.length) }}>
              <h2 className="heute__h2">Demnächst</h2>
              {soon.map((o) => (
                <button type="button" key={o.id + o.occ_date} className="heute__soon" onClick={() => nav('/woche')}>
                  <span className="heute__pill">{spanLabel(o.occ_date, o.occ_end)}</span>
                  <span className="hand hand--navy" style={{ fontSize: 25, lineHeight: 1.1 }}>{o.title}</span>
                </button>
              ))}
            </section>
          )}

          <div className="spacer" />

          {pinned.length > 0 && (
            <div className={'ank__chips' + rc} style={{ paddingTop: 16, ...rs(6 + rows.length) }}>
              {pinned.map((a) => (
                <Link key={a.id} to={'/anker/' + a.id} className="ank__chip">
                  <span style={{ color: 'var(--gold)' }} aria-hidden>⚓︎</span>
                  {a.title}
                  {isResting(a, now) && <span className="ank__dot" role="img" aria-label="ruht" />}
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {takeover && <Takeover date={date} state={day} fx={fx} onClose={() => setTakeover(false)} />}
      {editEvent && <EventEditor event={editEvent} onClose={() => setEditEvent(null)} />}
      {editSlots && <SlotEditor slots={editSlots} date={date} state={day} onClose={() => setEditSlots(null)} />}
      {editTask && <TaskEditor task={editTask} onClose={() => setEditTask(null)} />}
      {sonst && <SonstigesSheet onClose={() => { setSonst(false); if ((location.state as { sonstiges?: boolean } | null)?.sonstiges) nav(location.pathname, { replace: true, state: null }) }} />}
      {nix && (
        <GehtNix
          moved={dayTasks.filter((t) => t.owner_member_id === me?.id && t.area === 'casa' && !isShared(t))}
          kept={[...dayTasks.filter((t) => !(t.owner_member_id === me?.id && t.area === 'casa' && !isShared(t))).map((t) => t.title), ...rows.map((r) => (r.time ? `${r.time} ${r.title}` : r.title))]}
          partner={partner?.display_name ?? null}
          onClose={() => setNix(false)}
          onDone={(n, run) => {
            setNix(false)
            setUndoNix({ n, run })
          }}
        />
      )}
      {answers && <AnswerSheet requests={toAnswer} tasks={toAccept} onClose={() => setAnswers(false)} />}
      {undoNix && (
        <div className="undo-bar" role="status">
          <span className="undo-bar__text">{undoNix.n === 1 ? '1 Sache' : `${undoNix.n} Sachen`} auf morgen</span>
          <button type="button" className="undo-bar__btn" onClick={() => { const u = undoNix; setUndoNix(null); void u.run() }}>Rückgängig</button>
        </div>
      )}
    </div>
  )
}

/** „Das braucht deine Antwort“: Anfragen „Kannst du übernehmen?“ und neue Aufgaben vom anderen */
function AnswerSheet({ requests, tasks, onClose }: { requests: SlotRequest[]; tasks: Task[]; onClose: () => void }) {
  const casa = useCasa()
  const today = useToday()
  const voice = { me: casa.me, members: casa.members }
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const run = async (id: string, f: () => Promise<void>) => {
    setBusy(id)
    setErr(null)
    try {
      await f()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const slotWord: Record<string, string> = { valerie_bringen: 'Valerie bringen', valerie_holen: 'Valerie holen', valerie_tag: 'Valerie tagsüber', abend_essen: 'kochen', abend_bett: 'ins Bett bringen' }
  const from = (id: string | null) => casa.members.find((m) => m.id === id)?.display_name ?? ''
  const empty = requests.length === 0 && tasks.length === 0
  useEffect(() => {
    if (empty) onClose()
  }, [empty, onClose])
  return (
    <Sheet onClose={onClose} title="Das braucht deine Antwort">
      {requests.map((r) => (
        <div className="answer" key={r.id}>
          <span className="label label--small">{askText(r, voice)}</span>
          <span className="hand hand--navy" style={{ fontSize: 25, lineHeight: 1.15 }}>
            {dayWord(r.date, today)}: {slotWord[r.slot] ?? r.slot}{r.at ? ` um ${hhmm(r.at)}` : ''}?
          </span>
          <div className="answer__btns">
            <button type="button" className="btn" disabled={busy === r.id} onClick={() => void run(r.id, () => casa.answerRequest(r.id, true))}>Ja, mach ich</button>
            <button type="button" className="link" disabled={busy === r.id} onClick={() => void run(r.id, () => casa.answerRequest(r.id, false))}>Geht nicht</button>
          </div>
        </div>
      ))}
      {tasks.map((t) => (
        <div className="answer" key={t.id}>
          <span className="label label--small">Von {from(t.created_by)} · bis {dayWord(t.due_date, today)}</span>
          <span className="hand hand--navy" style={{ fontSize: 25, lineHeight: 1.15 }}>{t.title}</span>
          <div className="answer__btns">
            <button type="button" className="btn" disabled={busy === t.id} onClick={() => void run(t.id, async () => { await casa.markSeen('task', [t.id]); await casa.acceptTask(t.id) })}>Mach ich</button>
            <button type="button" className="link" disabled={busy === t.id} onClick={() => void run(t.id, async () => { await casa.markSeen('task', [t.id]); await casa.updateTask(t.id, { owner_member_id: null }) })}>Geht nicht · offen lassen</button>
          </div>
        </div>
      ))}
      {err && <span className="hint hint--brown">{err}</span>}
      <span className="hint">{from(casa.partner?.id ?? null) || 'Der andere'} bekommt deine Antwort als Mitteilung.</span>
    </Sheet>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function isPersonName(v: string, members: { display_name: string }[], people: { name: string }[]) {
  const t = v.trim().toLowerCase()
  return members.some((m) => m.display_name.toLowerCase() === t) || people.some((p) => p.name.toLowerCase() === t)
}

export { whoName, spanLabel }

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}
