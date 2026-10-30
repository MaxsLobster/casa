import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, dayLabel, eventEnd, fromISO, hhmm, isoWeek, uhr, weekdayLong, weekdayShort, type ISODate } from '../lib/dates'
import { dayState, name as whoName, verb, type Voice } from '../lib/week'
import { dailyText, moonPhase, readDailyChoice, sunTimes, writeDailyChoice, type DailyKind } from '../lib/daily'
import { isMultiDay, occurrences, type Occurrence } from '../lib/recur'
import { BAND_END as T_END, BAND_START as T_START, goldSegments, navySegments, pct, toH } from '../lib/band'
import { Check } from '../components/ui'
import type { Task } from '../lib/types'

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']


interface Row {
  key: string
  sort: number
  time: string | null // „18:00" oder null (Gold-Punkt)
  kind: 'event' | 'task' | 'valerie' | 'plan'
  title: string
  sub: string
  task?: Task
  isNew?: boolean
}

export function Heute() {
  const casa = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const { me, partner, members, people, tasks, events, normalWeek, overrides, setTaskDone, isNew, markSeen } = casa
  const voice: Voice = { me, members }

  // ---------- Kopf ----------
  const d = fromISO(today)
  const sun = useMemo(() => sunTimes(today), [today])
  const moon = useMemo(() => moonPhase(today), [today])

  // ---------- Satz des Tages ----------
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
  const shown = choice.chosen && choice.open ? texts[choice.chosen] : null

  // ---------- Heute noch ----------
  const day = useMemo(() => dayState(today, normalWeek, overrides), [today, normalWeek, overrides])
  const occToday = useMemo(() => occurrences(events, today, today).filter((o) => o.occ_date <= today && o.occ_end >= today), [events, today])
  const nowH = now.getHours() + now.getMinutes() / 60

  const whoEvent = (o: Occurrence) => {
    if (o.person_id) return people.find((p) => p.id === o.person_id)?.name ?? ''
    if (!o.member_id) return 'ihr beide'
    if (o.member_id === me?.id) return 'du'
    return members.find((m) => m.id === o.member_id)?.display_name ?? ''
  }

  const rows: Row[] = []
  // Termine heute, noch nicht vorbei
  for (const o of occToday) {
    if (isMultiDay(o)) continue
    if (eventEnd({ date: today, start_time: o.start_time, end_time: o.end_time }) <= now) continue
    const parts = [whoEvent(o)]
    if (o.end_time) parts.push(`bis ${uhr(o.end_time)}`)
    rows.push({ key: 'e' + o.id + o.occ_date, sort: o.start_time ? toH(o.start_time, 0) : -1, time: o.start_time ? hhmm(o.start_time) : null, kind: 'event', title: o.title + (o.is_repeat || o.repeat ? ' ↻' : ''), sub: parts.join(' · '), isNew: isNew('event', o) })
  }
  // Normalwoche heute, solange es noch kommt; offene Slots gar nicht
  const b = day.valerie_bringen
  if (b?.value && nowH < 9) rows.push({ key: 'vb', sort: 8, time: null, kind: 'valerie', title: `${cap(verb(b.value, voice, 'bringst', 'bringt'))} Valerie`, sub: 'Valerie' })
  const h = day.valerie_holen
  if (h?.value && !h.is_open) {
    const hh = toH(h.at, 14)
    if (nowH < hh) rows.push({ key: 'vh', sort: hh, time: h.at ? hhmm(h.at) : null, kind: 'valerie', title: `${cap(verb(h.value, voice, 'holst', 'holt'))} Valerie`, sub: h.note && h.overridden ? h.note : 'Valerie' })
  }
  const nm = day.nachmittag
  if (nm?.value && nowH < 18) rows.push({ key: 'nm', sort: 15, time: null, kind: 'plan', title: nm.value, sub: 'Nachmittag' })
  const es = day.abend_essen
  if (es?.value && !es.is_open && nowH < 19.5) {
    const person = isPersonName(es.value, members, people)
    rows.push({ key: 'es', sort: 18.5, time: null, kind: 'plan', title: person ? cap(verb(es.value, voice, 'kochst', 'kocht')) : `Essen ${es.value}`, sub: 'Abend' })
  }
  const bt = day.abend_bett
  if (bt?.value && !bt.is_open && nowH < 20.5) rows.push({ key: 'bt', sort: 19.5, time: null, kind: 'plan', title: cap(verb(bt.value, voice, 'bringst ins Bett', 'bringt ins Bett')), sub: 'Abend' })
  const we = day.wochenende
  if (we?.value && !we.is_open && nowH < 20) rows.push({ key: 'we', sort: 9, time: null, kind: 'plan', title: we.value, sub: 'Wochenende' })
  // Nur meine Aufgaben, nur genau heute fällig (Überfälliges steht unter To-Dos bei „Liegt noch")
  for (const t of tasks) {
    if (t.status === 'erledigt' || t.due_date !== today || t.owner_member_id !== me?.id) continue
    rows.push({ key: 't' + t.id, sort: 99, time: null, kind: 'task', title: t.title, sub: 'heute fällig', task: t, isNew: isNew('task', t) })
  }
  rows.sort((a, c) => a.sort - c.sort)

  // ---------- Demnächst ----------
  const soon = useMemo(() => {
    const to = addDays(today, 7)
    return occurrences(events, today, to).filter((o) => isMultiDay(o) && o.occ_end >= today)
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
  const gold = goldSegments(day, occToday, members)
  const navy = navySegments(occToday, me?.id ?? null)
  const fill = Math.min(Math.max(nowH, T_START), T_END)
  const fillPct = pct(fill)
  const inRange = nowH >= T_START && nowH <= T_END

  return (
    <div className="page heute">
      {/* ---------- Kopf ---------- */}
      <div className="heute__head">
        <div className="heute__date">
          <span className="heute__num">{d.getDate()}</span>
          <div className="stack" style={{ gap: 2, paddingBottom: 4 }}>
            <span className="heute__wd">{weekdayLong(today)}</span>
            <span className="kicker" style={{ fontSize: 12 }}>{MONTHS[d.getMonth()]} · KW {isoWeek(today)}</span>
          </div>
        </div>
        <div className="heute__tear" />
        <div className="heute__info">
          <span className="heute__sun" title="Sonnenaufgang – Sonnenuntergang">
            <SunIcon />
            {sun.sunrise}–{sun.sunset}
          </span>
          <span className="heute__sun" title="Mondphase">
            <MoonIcon phase={moon.phase} />
            {moon.label}
          </span>
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
        </div>
        {shown && (
          <figure className="heute__figure fade-in">
            <span className="label label--small">{shown.label}</span>
            <blockquote className="hand" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>{shown.text}</blockquote>
            {shown.source && <figcaption className="label" style={{ alignSelf: 'flex-end', fontSize: 12 }}>{shown.source}</figcaption>}
          </figure>
        )}
      </div>

      {/* ---------- Inhalt + Zeitstrahl ---------- */}
      <div className="heute__body">
        <div className="heute__left">
          {newCount > 0 && (
            <button type="button" className="note heute__note" onClick={openNew} style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}>
              <span className="label label--small" style={{ color: 'var(--brown)' }}>Neu von {partner?.display_name ?? 'Anna'}</span>
              <span className="hand" style={{ fontSize: 24, lineHeight: 1.15 }}>
                {firstNew}
                {newCount > 1 && <span className="hand hand--meta" style={{ marginLeft: 8 }}>+{newCount - 1} weitere</span>}
              </span>
            </button>
          )}

          <section className="stack" style={{ gap: 12 }}>
            <h2 className="heute__h2">Heute noch</h2>
            {rows.length === 0 && <p className="hint">Nichts mehr für heute. Schön.</p>}
            {rows.map((r) => (
              <div className="heute__row" key={r.key}>
                <span className="heute__time">
                  {r.kind === 'task' && r.task ? (
                    <span style={{ transform: 'scale(0.8)', transformOrigin: 'center', marginLeft: 10 }}>
                      <Check done={false} onToggle={() => setTaskDone(r.task!.id, true)} label={`${r.title} abhaken`} />
                    </span>
                  ) : r.time ? (
                    r.time
                  ) : (
                    <span className={'heute__dot' + (r.kind === 'valerie' ? ' heute__dot--gold' : '')} />
                  )}
                </span>
                <div className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                  <span className="hand hand--navy" style={{ lineHeight: 1.1 }}>
                    {r.title}
                    {r.isNew && <span className="stamp stamp--new" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Neu</span>}
                  </span>
                  <span className="heute__sub">{r.sub}</span>
                </div>
              </div>
            ))}
          </section>

          {soon.length > 0 && (
            <section className="stack" style={{ gap: 8 }}>
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
          <Link to="/einstellungen" className="link" style={{ alignSelf: 'flex-start' }}>Einstellungen</Link>
        </div>

        <div className="tl" aria-label="Tagesverlauf">
          {[6, 9, 12, 15, 18, 21].map((hh) => (
            <span key={hh} className="tl__num" style={{ top: pct(hh) }}>{hh}</span>
          ))}
          {Array.from({ length: 17 }, (_, i) => T_START + i).map((hh) => (
            <span key={hh} className="tl__tick" style={{ top: pct(hh) }} />
          ))}
          {inRange && <span className="tl__now" style={{ top: fillPct }}>{`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`}</span>}
          <div className="tl__tube">
            <div className="tl__fill" style={{ height: fillPct }} />
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

/** „So–Di" bzw. „Sa" */
export function spanLabel(from: ISODate, to: ISODate): string {
  if (from === to) return weekdayShort(from)
  return `${weekdayShort(from)}–${weekdayShort(to)}`
}

export { whoName }

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function MoonIcon({ phase }: { phase: string }) {
  // Sichel links/rechts je nach Phase, voll oder leer
  const fill = phase === 'vollmond' ? 'var(--navy)' : 'none'
  const path = phase === 'zunehmend' ? 'M12 3a9 9 0 0 1 0 18a6.5 9 0 0 0 0-18z' : phase === 'abnehmend' ? 'M12 3a9 9 0 0 0 0 18a6.5 9 0 0 1 0-18z' : ''
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill={fill} stroke="var(--navy)" strokeWidth="1.6" />
      {path && <path d={path} fill="var(--navy)" />}
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
