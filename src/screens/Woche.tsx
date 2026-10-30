import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, eventEnd, fromISO, hhmm, isoWeek, shortDate, startOfWeek, weekDates, weekRange, weekday, weekdayLongByIndex, weekdayShort, weekdayShortByIndex, type ISODate } from '../lib/dates'
import { dayLines, daySummary, dayState, hasOverride, openHints, templateState, type DayState, type Voice } from '../lib/week'
import { isMultiDay, occurrences, type Occurrence } from '../lib/recur'
import { BAND_START, BAND_END, goldSegments, navySegments, pct, widthPct, type Seg } from '../lib/band'
import type { Event, Slot, Task } from '../lib/types'
import { Check, Chevron, Chips, Collapse, Sheet } from '../components/ui'
import { SlotEditor } from './SlotEditor'
import { EventEditor } from './EventEditor'
import { spanLabel } from './Heute'

type View = 'week' | 'normal'

interface DayRow {
  key: string
  date: ISODate
  wd: string
  dateLabel: string
  state: DayState
  events: Occurrence[]
  isToday: boolean
  isPast: boolean
  gold: Seg[]
  navy: Seg[]
  hasOpen: boolean
  tasks: Task[]
}

interface Strip {
  id: string
  top: number
  height: number
  kind: 'gold' | 'navy'
  openTop: boolean
  openBottom: boolean
}

const SCALE = [6, 10, 14, 18, 22]

/** Wochenoffset eines Datums gegenüber heute */
function weekOffset(date: ISODate, today: ISODate): number {
  return Math.round((fromISO(startOfWeek(date)).getTime() - fromISO(startOfWeek(today)).getTime()) / 604_800_000)
}

export function Woche() {
  const { me, members, people, normalWeek, overrides, events, tasks, settings, isNew, markSeen, setOverride, setTaskDone, updateSettings } = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const location = useLocation()
  // Vom NEU-Zettel aus: direkt die Woche mit diesem Tag öffnen
  const jumpTo = (location.state as { date?: ISODate } | null)?.date
  const [view, setView] = useState<View>('week')
  const [offset, setOffset] = useState(() => (jumpTo ? weekOffset(jumpTo, today) : 0))
  const [openKey, setOpenKey] = useState<string | null>(jumpTo ?? null)
  const [askLegend, setAskLegend] = useState(false)
  const [editSlots, setEditSlots] = useState<{ slots: Slot[]; date?: string; weekday?: number; state: DayState } | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [takeover, setTakeover] = useState<{ date: ISODate; state: DayState } | null>(null)
  useEffect(() => {
    if (!jumpTo) return
    setView('week')
    setOffset(weekOffset(jumpTo, today))
    setOpenKey(jumpTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo])

  const voice: Voice = { me, members }
  const monday = addDays(startOfWeek(today), offset * 7)
  const dates = useMemo(() => weekDates(monday), [monday])
  const sunday = dates[6]
  const occ = useMemo(() => occurrences(events, monday, sunday), [events, monday, sunday])
  const nowH = now.getHours() + now.getMinutes() / 60

  const rows: DayRow[] = useMemo(
    () =>
      dates.map((d) => {
        const state = dayState(d, normalWeek, overrides)
        const dayOcc = occ.filter((o) => o.occ_date <= d && o.occ_end >= d)
        const myTasks = d >= today ? tasks.filter((t) => t.owner_member_id === me?.id && t.status !== 'erledigt' && t.due_date === d) : []
        return {
          key: d,
          date: d,
          wd: weekdayShort(d),
          dateLabel: shortDate(d),
          state,
          events: dayOcc,
          isToday: d === today,
          isPast: d < today,
          gold: goldSegments(state, dayOcc, members),
          navy: navySegments(dayOcc, me?.id ?? null),
          hasOpen: !!(state.abend_essen?.is_open || state.abend_bett?.is_open || state.wochenende?.is_open),
          tasks: myTasks.sort((a, b) => a.created_at.localeCompare(b.created_at)),
        }
      }),
    [dates, normalWeek, overrides, occ, today, tasks, me?.id, members],
  )

  const templateRows = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((wd) => ({
        key: 'wd' + wd,
        weekday: wd,
        wd: wd === 6 ? 'Sa So' : weekdayShortByIndex(wd),
        state: templateState(wd, normalWeek),
      })),
    [normalWeek],
  )

  const multi = useMemo(() => occ.filter(isMultiDay), [occ])

  // Termine als gesehen merken, wenn der Tag aufgeklappt ist
  useEffect(() => {
    if (view !== 'week' || !openKey) return
    const day = rows.find((r) => r.key === openKey)
    const fresh = day?.events.filter((e) => isNew('event', e)).map((e) => e.base_id) ?? []
    if (fresh.length === 0) return
    const t = setTimeout(() => markSeen('event', [...new Set(fresh)]), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, view, rows])

  // ---------- Streifen für mehrtägige Ereignisse: Zeilen messen ----------
  const listRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [strips, setStrips] = useState<Strip[]>([])
  const measure = useCallback(() => {
    if (view !== 'week' || !listRef.current) {
      setStrips([])
      return
    }
    const base = listRef.current.getBoundingClientRect().top
    const out: Strip[] = []
    for (const m of multi) {
      const first = dates.find((d) => d >= m.occ_date) ?? dates[0]
      const last = [...dates].reverse().find((d) => d <= m.occ_end) ?? dates[6]
      const a = rowRefs.current[first]
      const b = rowRefs.current[last]
      if (!a || !b) continue
      const top = a.getBoundingClientRect().top - base
      const bottom = b.getBoundingClientRect().bottom - base
      out.push({ id: m.id + m.occ_date, top: Math.round(top), height: Math.round(bottom - top), kind: m.person_id ? 'gold' : 'navy', openTop: m.occ_date < monday, openBottom: m.occ_end > sunday })
    }
    setStrips((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out))
  }, [view, multi, dates, monday, sunday])
  useLayoutEffect(() => {
    measure()
    const t = setTimeout(measure, 300) // nach der Aufklapp-Animation
    return () => clearTimeout(t)
  }, [measure, openKey])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // ---------- Kopf ----------
  function go(n: number) {
    setOffset((o) => o + n)
    setOpenKey(null)
  }
  function home() {
    if (offset === 0) return
    setOffset(0)
    setOpenKey(null)
  }
  function openNormal() {
    setView('normal')
    setOpenKey('wd' + Math.min(weekday(today), 6))
  }
  function closeNormal() {
    setView('week')
    setOpenKey(null)
  }

  const whoEvent = (o: Occurrence) => {
    if (o.person_id) return people.find((p) => p.id === o.person_id)?.name ?? ''
    if (!o.member_id) return 'ihr beide'
    if (o.member_id === me?.id) return 'du'
    return members.find((m) => m.id === o.member_id)?.display_name ?? ''
  }

  function chipsFor(state: DayState) {
    const chips: { key: string; label: string }[] = []
    const es = state.abend_essen
    const bt = state.abend_bett
    if (es?.is_open && bt?.is_open) chips.push({ key: 'abend', label: 'Abend offen · übernehmen' })
    else if (es?.is_open) chips.push({ key: 'essen', label: 'Essen offen · übernehmen' })
    else if (bt?.is_open) chips.push({ key: 'bett', label: 'Bettgehen offen · übernehmen' })
    if (state.wochenende?.is_open) chips.push({ key: 'familientag', label: 'Familientag? · festlegen' })
    return chips
  }

  const fillPct = pct(Math.min(Math.max(nowH, BAND_START), BAND_END))

  // ---------- Normalwoche (Bearbeiten) ----------
  if (view === 'normal') {
    return (
      <div className="page wk" style={{ gap: 12, paddingRight: 18 }}>
        <header className="wk__head">
          <button type="button" className="wk__arrow" aria-label="Zurück zur Woche" onClick={closeNormal}>‹</button>
          <div className="wk__title" style={{ cursor: 'default' }}>
            <span className="wk__range">Eine normale Woche</span>
            <span className="kicker" style={{ fontSize: 12 }}>Unser Wochenplan</span>
          </div>
          <span style={{ width: 44, flex: 'none' }} />
        </header>

        <div className="wk__list">
          {templateRows.map((r) => {
            const isOpen = openKey === r.key
            const lines = dayLines(r.state, voice)
            const hints = openHints(r.state)
            return (
              <div className="wk__day" key={r.key}>
                <button type="button" className="wk__nrow" onClick={() => setOpenKey(isOpen ? null : r.key)} aria-expanded={isOpen}>
                  <span className="wk__wd" style={{ paddingTop: 2 }}>
                    <span className="wk__wd-name">{r.wd}</span>
                  </span>
                  <span className="wk__nline">{daySummary(r.state, voice) || '—'}</span>
                  <Chevron open={isOpen} />
                </button>
                <Collapse open={isOpen}>
                  <div className="wk__body" style={{ paddingRight: 0 }}>
                    {lines.map((l) => (
                      <button type="button" key={l.label} className="day__line" onClick={() => setEditSlots({ slots: l.slots, weekday: r.weekday, state: r.state })}>
                        <span className="label label--small">{l.label}</span>
                        <span className="hand">{l.text}</span>
                      </button>
                    ))}
                    {hints.length > 0 && <span className="hint hint--brown">Offen: {hints.join(', ').replace(/[.?!]$/, '')}. Klären wir in der Sonntagsrunde.</span>}
                  </div>
                </Collapse>
              </div>
            )
          })}
        </div>

        <p className="wk__legend">Orientierung, kein starres Regelwerk. Offenes klären wir in der Sonntagsrunde.</p>
        {editSlots && <SlotEditor slots={editSlots.slots} date={editSlots.date} weekday={editSlots.weekday} state={editSlots.state} onClose={() => setEditSlots(null)} />}
      </div>
    )
  }

  // ---------- Woche ----------
  return (
    <div className="page wk" style={{ gap: 10, paddingRight: 18 }}>
      <header className="wk__head">
        <button type="button" className="wk__arrow" aria-label="Vorige Woche" onClick={() => go(-1)}>‹</button>
        <button type="button" className="wk__title" onClick={home} aria-label={offset === 0 ? undefined : 'Zurück zur aktuellen Woche'}>
          <span className="wk__range">{weekRange(monday)}</span>
          <span className="kicker" style={{ fontSize: 12 }}>KW {isoWeek(monday)}</span>
        </button>
        <button type="button" className="wk__arrow" aria-label="Nächste Woche" onClick={() => go(1)}>›</button>
        <button type="button" className="wk__icon" aria-label="Normalwoche bearbeiten" onClick={openNormal}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="15" rx="2" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            <path d="M14.5 15.5a2.6 2.6 0 1 1-.8-2.2" />
            <path d="M14 11.8v1.8h-1.8" />
          </svg>
        </button>
      </header>

      {/* Stundenskala, exakt über dem Band */}
      <div className="wk__scale" aria-hidden>
        <span style={{ flex: 'none', width: 'var(--wk-wd)' }} />
        <div className="wk__scale-band">
          {SCALE.map((h, i) => (
            <span key={h} className={'wk__scale-num' + (i === 0 ? ' wk__scale-num--first' : i === SCALE.length - 1 ? ' wk__scale-num--last' : '')} style={{ left: pct(h) }}>
              {h}
            </span>
          ))}
        </div>
        <span style={{ flex: 'none', width: 'var(--wk-icons)' }} />
        <span className="wk__gap" />
      </div>

      <div className="wk__list" ref={listRef}>
        {strips.length > 0 && (
          <div className="wk__strips" aria-hidden>
            {strips.map((s) => (
              <div key={s.id} className={`wk__strip wk__strip--${s.kind}` + (s.openTop ? ' wk__strip--open-top' : '') + (s.openBottom ? ' wk__strip--open-bottom' : '')} style={{ top: s.top + 6, height: s.height - 12 }} />
            ))}
          </div>
        )}

        {rows.map((r) => {
          const isOpen = openKey === r.key
          const lines = dayLines(r.state, voice)
          const chips = chipsFor(r.state)
          const changed = hasOverride(r.state)
          return (
            <div className={'wk__day' + (r.isToday ? ' wk__day--today' : '') + (r.isPast && !isOpen ? ' wk__day--past' : '')} key={r.key} ref={(el) => { rowRefs.current[r.date] = el }}>
              <button type="button" className="wk__row" onClick={() => setOpenKey(isOpen ? null : r.key)} aria-expanded={isOpen}>
                <span className="wk__wd">
                  <span className={'wk__wd-name' + (r.isToday ? ' wk__wd-name--today' : '')}>{r.wd}</span>
                  <span className="wk__wd-date">{r.dateLabel}</span>
                </span>
                <span className="wk__band" aria-label="Tagesverlauf 6 bis 22 Uhr">
                  {r.gold.map((s, i) => (
                    <span key={'g' + i} className="wk__seg wk__seg--gold" style={{ left: pct(s.from), width: widthPct(s) }} />
                  ))}
                  {r.navy.map((s, i) => (
                    <span key={'n' + i} className="wk__seg wk__seg--navy" style={{ left: pct(s.from), width: widthPct(s) }} />
                  ))}
                  {r.isToday && nowH >= BAND_START && <span className="wk__fill" style={{ width: fillPct }} />}
                </span>
                <span className="wk__icons">
                  {r.hasOpen && <span className="wk__open" role="img" aria-label="Etwas offen" />}
                  {r.tasks.length > 0 && <span className="wk__count" role="img" aria-label={`${r.tasks.length} Aufgaben fällig`}>{r.tasks.length}</span>}
                </span>
                <span className="wk__gap" />
              </button>

              <Collapse open={isOpen}>
                <div className="wk__body">
                  {lines.map((l) => {
                    const isChanged = l.slots.some((s) => r.state[s]?.overridden)
                    return (
                      <button
                        type="button"
                        key={l.label}
                        className={'day__line' + (isChanged ? ' day__line--changed' : '')}
                        onClick={() => setEditSlots({ slots: l.slots.filter((s) => r.state[s]), date: r.date, state: r.state })}
                      >
                        <span className="label label--small">{l.label}</span>
                        <span className="hand">{l.text}</span>
                      </button>
                    )
                  })}
                  {changed && lines.length === 0 && <span className="hint">Abweichung an diesem Tag.</span>}

                  {r.events.length > 0 && (
                    <div className="stack stack--tight">
                      <span className="label label--small">Termine</span>
                      {r.events.map((e) => {
                        const past = !isMultiDay(e) && eventEnd({ date: e.occ_date, start_time: e.start_time, end_time: e.end_time }) <= now
                        return (
                          <button type="button" key={e.id + e.occ_date} className={'day__line' + (past ? ' day__line--past' : '')} style={{ minHeight: 40, padding: '2px 0' }} onClick={() => setEditEvent(events.find((x) => x.id === e.base_id) ?? null)}>
                            <span className="hand" style={{ fontSize: 22 }}>
                              {isMultiDay(e) ? `${spanLabel(e.occ_date, e.occ_end)} · ` : hhmm(e.start_time) ? hhmm(e.start_time) + ' ' : ''}
                              {e.title}
                              {(e.repeat || e.is_repeat) && ' ↻'}
                              <span className="hand hand--meta" style={{ marginLeft: 8 }}>{whoEvent(e)}</span>
                              {isNew('event', e) && <span className="stamp stamp--new" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Neu</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {chips.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {chips.map((c) => (
                        <button key={c.key} type="button" className="wk__chip" onClick={() => setTakeover({ date: r.date, state: r.state })}>{c.label}</button>
                      ))}
                    </div>
                  )}

                  {r.tasks.length > 0 && (
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="label label--small">Für dich fällig</span>
                      {r.tasks.map((t) => (
                        <div className="wk__task" key={t.id}>
                          <Check done={false} onToggle={() => setTaskDone(t.id, true)} label={`${t.title} abhaken`} />
                          <span className="hand hand--navy" style={{ fontSize: 22, lineHeight: 1.15 }}>{t.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0' }} onClick={() => nav('/neu', { state: { kind: 'termin', date: r.date } })}>
                    + Termin an diesem Tag
                  </button>
                </div>
              </Collapse>
            </div>
          )
        })}
      </div>

      {(settings?.show_legend ?? true) && (
        <div className="wk__legend-row">
          <p className="wk__legend">Gold: Valerie versorgt · Navy: Termin · Kreis mit Zahl: deine Aufgaben · gestrichelt: noch offen · Streifen rechts: mehrere Tage</p>
          <button type="button" className="wk__legend-x" aria-label="Legende ausblenden" onClick={() => setAskLegend(true)}>×</button>
        </div>
      )}
      {askLegend && (
        <Sheet onClose={() => setAskLegend(false)} title="Legende ausblenden">
          <span className="hand hand--navy" style={{ fontSize: 26 }}>Nicht mehr anzeigen?</span>
          <span className="hint">Die Legende verschwindet dann dauerhaft, auf allen deinen Geräten. In den Einstellungen kannst du sie wieder einblenden.</span>
          <button type="button" className="btn" onClick={() => { void updateSettings({ show_legend: false }); setAskLegend(false) }}>Ja, ausblenden</button>
          <button type="button" className="link" onClick={() => setAskLegend(false)}>Abbrechen</button>
        </Sheet>
      )}

      {editSlots && <SlotEditor slots={editSlots.slots} date={editSlots.date} weekday={editSlots.weekday} state={editSlots.state} onClose={() => setEditSlots(null)} />}
      {editEvent && <EventEditor event={editEvent} onClose={() => setEditEvent(null)} />}
      {takeover && (
        <Takeover
          date={takeover.date}
          state={takeover.state}
          onClose={() => setTakeover(null)}
          onSave={async (slot, value) => {
            await setOverride({ date: takeover.date, slot, value })
          }}
        />
      )}
    </div>
  )
}

/** Offene Slots eines Tages übernehmen: Ich / Anna / Oma … bzw. Familientag festlegen */
function Takeover({ date, state, onClose, onSave }: { date: ISODate; state: DayState; onClose: () => void; onSave: (slot: Slot, value: string) => Promise<void> }) {
  const { me, members, people, setOverride } = useCasa()
  const close = useCallback(() => onClose(), [onClose])
  const partners = members.filter((m) => m.role === 'partner')
  const open: Slot[] = (['abend_essen', 'abend_bett'] as Slot[]).filter((s) => state[s]?.is_open)
  const weekendOpen = !!state.wochenende?.is_open
  const [choice, setChoice] = useState<Record<string, string | null>>({})
  const [familientag, setFamilientag] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const label: Record<string, string> = { abend_essen: 'Wer kocht?', abend_bett: 'Wer bringt ins Bett?' }
  const options = [...partners.map((m) => ({ value: m.display_name, label: m.id === me?.id ? 'Ich' : m.display_name })), ...people.map((p) => ({ value: p.name, label: p.name }))]
  const wd = weekday(date)
  const sat = wd === 6 ? date : wd === 7 ? addDays(date, -1) : date
  const sun = addDays(sat, 1)

  async function save() {
    setBusy(true)
    try {
      for (const s of open) if (choice[s]) await onSave(s, choice[s]!)
      if (weekendOpen && familientag) {
        await setOverride({ date: familientag === 'sa' ? sat : sun, slot: 'wochenende', value: 'Familientag' })
        await setOverride({ date: familientag === 'sa' ? sun : sat, slot: 'wochenende', value: 'Geteilte Betreuung' })
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }
  const ready = open.some((s) => choice[s]) || (weekendOpen && familientag)

  return (
    <Sheet onClose={close} title="Übernehmen">
      <div className="between">
        <span className="kicker">{weekdayLongByIndex(wd)}, {shortDate(date)}</span>
        <button type="button" className="link" onClick={close}>Schließen</button>
      </div>
      {open.map((s) => (
        <div className="stack" key={s}>
          <span className="label">{label[s]}</span>
          <Chips options={options} value={choice[s] ?? null} onChange={(v) => setChoice((c) => ({ ...c, [s]: v }))} />
        </div>
      ))}
      {weekendOpen && (
        <div className="stack">
          <span className="label">Welcher Tag ist Familientag?</span>
          <Chips options={[{ value: 'sa', label: 'Samstag' }, { value: 'so', label: 'Sonntag' }]} value={familientag} onChange={setFamilientag} variant="date" />
          <span className="hint">Der andere Tag wird „geteilte Betreuung“.</span>
        </div>
      )}
      <button type="button" className="btn" disabled={!ready || busy} onClick={save}>Übernehmen</button>
    </Sheet>
  )
}
