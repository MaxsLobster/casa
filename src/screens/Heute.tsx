import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, dayLabel, eventEnd, fromISO, hhmm, isoWeek, spanLabel, uhr, weekdayLong } from '../lib/dates'
import { dayState, name as whoName, verb, type Voice } from '../lib/week'
import { applyEffects, awayOn, dayEffects, isEffectEvent, openChips, personName } from '../lib/effects'
import { dailyText, moonPhase, readDailyChoice, sunTimes, writeDailyChoice, type DailyKind } from '../lib/daily'
import { isMultiDay, occurrences, type Occurrence } from '../lib/recur'
import { BAND_END as T_END, BAND_START as T_START, goldSegments, navySegments, pct, toH } from '../lib/band'
import { Check } from '../components/ui'
import type { Event, Slot, Task } from '../lib/types'
import { wantsStagger } from '../state/splash'
import { PotIcon } from '../mila/icons'
import { Takeover } from './Takeover'
import { EventEditor } from './EventEditor'
import { SlotEditor } from './SlotEditor'
import { TaskEditor } from './TaskEditor'
import { isResting } from '../lib/anchors'
import { isFairEvent, isShared, isWorkday } from '../lib/mwf'
import { MwfIcon } from '../mwf/MwfIcon'

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

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
}

type Slide = null | 'out-left' | 'out-right' | 'enter-left' | 'enter-right'

export function Heute() {
  const casa = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const location = useLocation()
  const { me, partner, members, people, tasks: allTasks, events, normalWeek, overrides, anchors: allAnchors, pins, settings, setTaskDone, takeTask, isNew, markSeen } = casa
  // Casa zeigt nur den Bereich casa; bei Arbeitstag an zusätzlich meine heute fälligen MWF-Aufgaben
  const workday = isWorkday(settings, today)
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
  const moon = useMemo(() => moonPhase(date), [date])

  // ---------- Satz des Tages (nur heute) ----------
  const [choice, setChoice] = useState(() => readDailyChoice(today))
  useEffect(() => {
    setChoice(readDailyChoice(today))
  }, [today])
  const texts = useMemo(
    () => ({ weisheit: dailyText('weisheit', today), wort: dailyText('wort', today), heute: dailyText('heute', today) }),
    [today],
  )
  function pick(k: DailyKind) {
    if (!texts[k]) return
    if (choice.chosen && choice.chosen !== k) return
    const next = choice.chosen ? { ...choice, open: !choice.open } : { date: today, chosen: k, open: true }
    setChoice(next)
    writeDailyChoice(next)
  }
  const shown = isToday && choice.chosen && choice.open ? texts[choice.chosen] : null

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
  const present = (slots: Slot[]) => slots.filter((x) => day[x])

  const whoEvent = (o: Occurrence) => {
    if (o.person_id) return people.find((p) => p.id === o.person_id)?.name ?? ''
    if (!o.member_id) return 'ihr beide'
    if (o.member_id === me?.id) return 'du'
    return members.find((m) => m.id === o.member_id)?.display_name ?? ''
  }

  const rows: Row[] = []
  // Wirkungs-Ereignisse, die an dem Tag gelten: Valerie bei Oma, Max/Anna weg („Kita zu" ist Hintergrundwissen)
  const vw = fx.valerieWeg
  if (vw) {
    const pn = personName(vw, people)
    rows.push({ key: 'fxv', sort: -3, time: null, kind: 'valerie', title: pn ? `Valerie bei ${pn}` : vw.title, sub: spanLabel(vw.occ_date, vw.occ_end), isNew: isNew('event', vw), event: vw.base_id })
    if (fx.isFirst && vw.dropoff_by && (!vw.dropoff_at || nowH < toH(vw.dropoff_at, 0))) {
      rows.push({ key: 'fxd', sort: vw.dropoff_at ? toH(vw.dropoff_at, 0) : -2, time: vw.dropoff_at ? hhmm(vw.dropoff_at) : null, kind: 'valerie', title: `${cap(verb(vw.dropoff_by, voice, 'bringst', 'bringt'))} Valerie ${pn ? `zu ${pn}` : 'hin'}`, sub: 'Übergabe', event: vw.base_id })
    }
    if (fx.isLast && vw.pickup_by && (!vw.pickup_at || nowH < toH(vw.pickup_at, 0))) {
      rows.push({ key: 'fxp', sort: vw.pickup_at ? toH(vw.pickup_at, 0) : -2, time: vw.pickup_at ? hhmm(vw.pickup_at) : null, kind: 'valerie', title: `${cap(verb(vw.pickup_by, voice, 'holst', 'holt'))} Valerie ${pn ? `bei ${pn} ` : ''}ab`, sub: 'Übergabe', event: vw.base_id })
    }
  }
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
  // Normalwoche, heute solange es noch kommt; offene Slots nur als Chip (an anderen Tagen)
  const b = day.valerie_bringen
  if (b?.value && !b.is_open && nowH < 9) rows.push({ key: 'vb', sort: 8, time: b.at ? hhmm(b.at) : null, kind: 'valerie', title: `${cap(verb(b.value, voice, 'bringst', 'bringt'))} Valerie`, sub: 'Valerie', slots: present(['valerie_bringen', 'valerie_holen', 'valerie_tag']) })
  const h = day.valerie_holen
  if (h?.value && !h.is_open) {
    const hh = toH(h.at, 14)
    if (nowH < hh) rows.push({ key: 'vh', sort: hh, time: h.at ? hhmm(h.at) : null, kind: 'valerie', title: `${cap(verb(h.value, voice, 'holst', 'holt'))} Valerie`, sub: h.note && h.overridden ? h.note : 'Valerie', slots: present(['valerie_bringen', 'valerie_holen', 'valerie_tag']) })
  }
  const tg = day.valerie_tag
  if (tg?.value && !tg.is_open && nowH < 18) {
    rows.push({ key: 'vt', sort: 8.5, time: null, kind: 'valerie', title: `Valerie tagsüber bei ${/^beide$/i.test(tg.value) ? 'euch beiden' : whoName(tg.value, voice) === 'du' ? 'dir' : tg.value}`, sub: 'Valerie', slots: present(['valerie_bringen', 'valerie_holen', 'valerie_tag']) })
  }
  const nm = day.nachmittag
  if (nm?.value && nowH < 18) rows.push({ key: 'nm', sort: 15, time: null, kind: 'plan', title: nm.value, sub: 'Nachmittag', slots: ['nachmittag'] })
  const es = day.abend_essen
  if (es?.value && !es.is_open && nowH < 19.5) {
    const person = isPersonName(es.value, members, people)
    rows.push({ key: 'es', sort: 18.5, time: null, kind: 'plan', title: person ? cap(verb(es.value, voice, 'kochst', 'kocht')) : `Essen ${es.value}`, sub: 'Abend', slots: present(['abend_essen', 'abend_bett']) })
  }
  const bt = day.abend_bett
  if (bt?.value && !bt.is_open && nowH < 20.5) rows.push({ key: 'bt', sort: 19.5, time: null, kind: 'plan', title: cap(verb(bt.value, voice, 'bringst ins Bett', 'bringt ins Bett')), sub: 'Abend', slots: present(['abend_essen', 'abend_bett']) })
  const we = day.wochenende
  if (we?.value && !we.is_open && nowH < 20) rows.push({ key: 'we', sort: 9, time: null, kind: 'plan', title: we.value, sub: 'Wochenende', slots: ['wochenende'] })
  // Nur meine Aufgaben, nur genau an dem Tag fällig (Überfälliges steht unter To-Dos bei „Liegt noch")
  for (const t of tasks) {
    if (t.status === 'erledigt' || t.due_date !== date || !(t.owner_member_id === me?.id || isShared(t))) continue
    // Weg: in Casa zählt auch der Messetag, bei MWF-Aufgaben nur echte Abwesenheit
    const away = !!t.owner_member_id && (t.area === 'mwf' ? awayOn(events, t.owner_member_id, date, 'mwf') : fx.away.some((a) => a.member.id === t.owner_member_id))
    rows.push({ key: 't' + t.id, sort: 99, time: null, kind: 'task', title: t.title, sub: away ? 'Du bist weg – trotzdem bei dir lassen?' : isShared(t) ? 'beide' : '', task: t, isNew: isNew('task', t), anchor: anchorName(t.anchor_id), mwf: t.area === 'mwf' })
  }
  rows.sort((a, c) => a.sort - c.sort)
  const chips = isToday ? [] : openChips(day, fx)
  // Offene Aufgaben (noch niemand): heute fällig oder überfällig, an anderen Tagen genau an dem Tag
  const openTasks = tasks.filter((t) => t.area === 'casa' && t.status !== 'erledigt' && t.owner_member_id === null && (isToday ? t.due_date <= today : t.due_date === date)).sort((a, c) => a.due_date.localeCompare(c.due_date))
  // Meine gepinnten Anker (nur heute)
  const pinned = isToday ? anchors.filter((a) => pins.has(a.id) && !a.archived_at).sort((a, c) => a.title.localeCompare(c.title)) : []

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

  // ---------- Zeitstrahl ----------
  // Gleiche Rechnung wie das Mini-Band in der Woche
  const gold = goldSegments(date, day, occDay, members)
  const navy = navySegments(occDay, me?.id ?? null)
  const fill = Math.min(Math.max(nowH, T_START), T_END)
  const fillPct = pct(fill)
  const inRange = isToday && nowH >= T_START && nowH <= T_END
  // Stundenzahlen nahe am Jetzt-Etikett ausblenden
  const nearNow = (hh: number) => inRange && Math.abs(hh - nowH) < 0.75

  const slideCls = slide ? ` heute--${slide}` : ''

  return (
    <div className={'page heute' + slideCls} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Link to="/einstellungen" className="heute__gear" aria-label="Einstellungen">
        <GearIcon />
      </Link>
      <Link to="/mila/woche" className="heute__gear heute__pot" aria-label="Mila, der Essensplaner">
        <PotIcon />
      </Link>
      {workday && (
        <Link to="/mwf/hub" className="heute__gear heute__mwf" aria-label="Munich Watch Fair">
          <MwfIcon />
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
            <span className="kicker" style={{ fontSize: 12 }}>{MONTHS[d.getMonth()]} · KW {isoWeek(date)}</span>
          </div>
        </div>
        <div className={'heute__tear' + rc} style={rs(1)} />
        <div className={'heute__info' + rc} style={rs(2)}>
          <span className="heute__sun" title="Sonnenaufgang – Sonnenuntergang">
            <SunIcon />
            {sun.sunrise}–{sun.sunset}
          </span>
          <span className="heute__sun" title="Mondphase">
            <MoonIcon fraction={moon.fraction} waxing={moon.waxing} label={moon.label} />
            {moon.label}
          </span>
          {isToday && (
            <span className="heute__cats">
              {(['weisheit', 'wort', 'heute'] as DailyKind[]).map((k) => {
                const chosen = choice.chosen === k
                const locked = (!!choice.chosen && !chosen) || !texts[k]
                const cls = 'heute__cat' + (chosen && choice.open ? ' heute__cat--open' : '') + (chosen && !choice.open ? ' heute__cat--chosen' : '') + (locked ? ' heute__cat--locked' : '')
                const aria = { weisheit: 'Weisheit des Tages', wort: 'Wort des Tages', heute: 'Heute vor Jahren' }[k] + (locked ? ' (heute nicht wählbar)' : '')
                return (
                  <button key={k} type="button" className={cls} aria-label={aria} disabled={locked} onClick={() => pick(k)}>
                    {k === 'weisheit' && <FeatherIcon />}
                    {k === 'wort' && <span style={{ fontSize: 14, fontWeight: 600 }}>Aa</span>}
                    {k === 'heute' && <HourglassIcon />}
                  </button>
                )
              })}
            </span>
          )}
        </div>
        {shown && (
          <figure className={stagger ? 'heute__figure rise' : 'heute__figure fade-in'} style={rs(3)}>
            <span className="label label--small">{shown.label}</span>
            <blockquote className="hand" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>{shown.text}</blockquote>
            {shown.source && <figcaption className="label" style={{ alignSelf: 'flex-end', fontSize: 12 }}>{shown.source}</figcaption>}
          </figure>
        )}
      </div>

      {/* ---------- Inhalt + Zeitstrahl ---------- */}
      <div className="heute__body">
        <div className="heute__left">
          {isToday && newCount > 0 && (
            <button type="button" className={'note heute__note' + rc} onClick={openNew} style={{ textAlign: 'left', width: '100%', cursor: 'pointer', ...rs(3) }}>
              <span className="label label--small" style={{ color: 'var(--brown)' }}>Neu von {partner?.display_name ?? 'Anna'}</span>
              <span className="hand" style={{ fontSize: 24, lineHeight: 1.15 }}>
                {firstNew}
                {newCount > 1 && <span className="hand hand--meta" style={{ marginLeft: 8 }}>+{newCount - 1} weitere</span>}
              </span>
            </button>
          )}

          <section className="stack" style={{ gap: 12 }}>
            <h2 className={'heute__h2' + rc} style={rs(4)}>{isToday ? 'Heute noch' : 'An diesem Tag'}</h2>
            {rows.length === 0 && chips.length === 0 && openTasks.length === 0 && <p className={'hint' + rc} style={rs(5)}>{isToday ? 'Nichts mehr für heute. Schön.' : 'Nichts eingetragen.'}</p>}
            {rows.map((r, idx) => {
              const open = () => {
                if (r.task) setEditTask(r.task)
                else if (r.event) {
                  const ev = events.find((x) => x.id === r.event) ?? null
                  if (ev && isFairEvent(ev)) nav('/mwf/hub')
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
          </section>

          {isToday && soon.length > 0 && (
            <section className={'stack' + rc} style={{ gap: 8, ...rs(5 + rows.length) }}>
              <h2 className="heute__h2">Demnächst</h2>
              {soon.map((o) => (
                <button type="button" key={o.id + o.occ_date} className="heute__soon" onClick={() => nav('/woche')}>
                  <span className="heute__pill">{spanLabel(o.occ_date, o.occ_end)}</span>
                  <span className="hand hand--navy" style={{ fontSize: 24, lineHeight: 1.1 }}>{o.title}</span>
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

        <div className={'tl' + rc} style={rs(3)} aria-label="Tagesverlauf">
          {[6, 9, 12, 15, 18, 21].map((hh) => (
            <span key={hh} className="tl__num" style={{ top: pct(hh), opacity: nearNow(hh) ? 0 : 1 }}>{hh}</span>
          ))}
          {Array.from({ length: 17 }, (_, i) => T_START + i).map((hh) => (
            <span key={hh} className="tl__tick" style={{ top: pct(hh) }} />
          ))}
          {inRange && <span className="tl__now" style={{ top: fillPct }}>{`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`}</span>}
          <div className="tl__tube">
            {isToday && <div className="tl__fill" style={{ height: fillPct }} />}
            {inRange && <div className="tl__knob" style={{ top: fillPct }} />}
            {gold.map((g, i) => (
              <div key={'g' + i} className="tl__seg tl__seg--gold" style={{ top: pct(g.from), height: `calc(${pct(g.to)} - ${pct(g.from)})` }} />
            ))}
            {navy.map((s, i) => (
              <div key={'n' + i} className="tl__seg tl__seg--navy" style={{ top: pct(s.from), height: `calc(${pct(s.to)} - ${pct(s.from)})` }} />
            ))}
          </div>
        </div>
      </div>

      {takeover && <Takeover date={date} state={day} fx={fx} onClose={() => setTakeover(false)} />}
      {editEvent && <EventEditor event={editEvent} onClose={() => setEditEvent(null)} />}
      {editSlots && <SlotEditor slots={editSlots} date={date} state={day} onClose={() => setEditSlots(null)} />}
      {editTask && <TaskEditor task={editTask} onClose={() => setEditTask(null)} />}
    </div>
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
/** Gezeichneter Mond in echter Phase: beleuchteter Anteil und Seite (zunehmend rechts, abnehmend links) */
function MoonIcon({ fraction, waxing, label }: { fraction: number; waxing: boolean; label: string }) {
  const r = 10
  const f = Math.min(Math.max(fraction, 0), 1)
  const rx = (r * Math.abs(2 * f - 1)).toFixed(2)
  // Außenbogen auf der beleuchteten Seite, zurück über die Schattengrenze (Ellipse)
  const outer = waxing ? 1 : 0
  const back = f >= 0.5 ? outer : 1 - outer
  const d = `M12 2 A${r} ${r} 0 0 ${outer} 12 22 A${rx} ${r} 0 0 ${back} 12 2 Z`
  return (
    <svg className="moon" width="22" height="22" viewBox="0 0 24 24" role="img" aria-label={`Mond ${label}, ${Math.round(f * 100)} Prozent`}>
      <circle cx="12" cy="12" r={r} className="moon__dark" />
      {f > 0.01 && <path d={d} className="moon__lit" />}
      <circle cx="12" cy="12" r={r} fill="none" className="moon__rim" strokeWidth="0.8" />
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
function FeatherIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 4c-6 0-11 4-12 11l-2 5" />
      <path d="M8 15c4 0 8-2 10-6" />
    </svg>
  )
}
function HourglassIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
    </svg>
  )
}
