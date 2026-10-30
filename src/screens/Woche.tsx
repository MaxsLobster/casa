import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, eventEnd, hhmm, isoWeek, shortDate, startOfWeek, weekDates, weekRange, weekday, weekdayLongByIndex, weekdayShort, weekdayShortByIndex, type ISODate } from '../lib/dates'
import { dayLines, daySummary, dayState, hasOverride, openHints, templateState, type DayState, type Voice } from '../lib/week'
import { isMultiDay, occurrences, type Occurrence } from '../lib/recur'
import type { Event, Slot } from '../lib/types'
import { Chevron, Chips, Collapse, Sheet } from '../components/ui'
import { SlotEditor } from './SlotEditor'
import { EventEditor } from './EventEditor'
import { spanLabel } from './Heute'

type View = 'week' | 'normal'

interface DayRow {
  key: string
  date?: ISODate
  weekday: number
  wd: string
  dateLabel: string
  state: DayState
  events: Occurrence[]
  isToday: boolean
}

export function Woche() {
  const { me, members, people, normalWeek, overrides, events, isNew, markSeen, setOverride } = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const [view, setView] = useState<View>('week')
  const [offset, setOffset] = useState(0)
  const [openKey, setOpenKey] = useState<string | null>(today)
  const [editSlots, setEditSlots] = useState<{ slots: Slot[]; date?: string; weekday?: number; state: DayState } | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [takeover, setTakeover] = useState<{ date: ISODate; state: DayState } | null>(null)

  const voice: Voice = { me, members }
  const monday = addDays(startOfWeek(today), offset * 7)
  const dates = useMemo(() => weekDates(monday), [monday])
  const sunday = dates[6]

  const occ = useMemo(() => occurrences(events, monday, sunday), [events, monday, sunday])

  const weekRows: DayRow[] = useMemo(
    () =>
      dates.map((d) => ({
        key: d,
        date: d,
        weekday: weekday(d),
        wd: weekdayShort(d),
        dateLabel: shortDate(d),
        state: dayState(d, normalWeek, overrides),
        events: occ.filter((o) => o.occ_date <= d && o.occ_end >= d),
        isToday: d === today,
      })),
    [dates, normalWeek, overrides, occ, today],
  )

  const templateRows: DayRow[] = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((wd) => ({
        key: 'wd' + wd,
        weekday: wd,
        wd: wd === 6 ? 'Sa So' : weekdayShortByIndex(wd),
        dateLabel: '',
        state: templateState(wd, normalWeek),
        events: [],
        isToday: false,
      })),
    [normalWeek],
  )

  const rows = view === 'week' ? weekRows : templateRows
  const multi = useMemo(() => occ.filter(isMultiDay), [occ])

  // Termine als gesehen merken, wenn der Tag aufgeklappt ist
  useEffect(() => {
    if (view !== 'week' || !openKey) return
    const day = weekRows.find((r) => r.key === openKey)
    const fresh = day?.events.filter((e) => isNew('event', e)).map((e) => e.base_id) ?? []
    if (fresh.length === 0) return
    const t = setTimeout(() => markSeen('event', [...new Set(fresh)]), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, view, weekRows])

  // ---------- Streifen für mehrtägige Ereignisse: Zeilen messen ----------
  const listRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [strips, setStrips] = useState<{ id: string; top: number; height: number; label: string; openTop: boolean; openBottom: boolean }[]>([])
  const measure = useCallback(() => {
    if (view !== 'week' || !listRef.current) {
      setStrips([])
      return
    }
    const base = listRef.current.getBoundingClientRect().top
    const out: typeof strips = []
    for (const m of multi) {
      const first = dates.find((d) => d >= m.occ_date) ?? dates[0]
      const last = [...dates].reverse().find((d) => d <= m.occ_end) ?? dates[6]
      const a = rowRefs.current[first]
      const b = rowRefs.current[last]
      if (!a || !b) continue
      const top = a.getBoundingClientRect().top - base
      const bottom = b.getBoundingClientRect().bottom - base
      out.push({ id: m.id + m.occ_date, top: Math.round(top), height: Math.round(bottom - top), label: m.title, openTop: m.occ_date < monday, openBottom: m.occ_end > sunday })
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
    setView('week')
    setOffset((o) => o + n)
    setOpenKey(null)
  }
  function pickTab(v: 'diese' | 'naechste' | 'normal') {
    if (v === 'normal') {
      setView('normal')
      setOpenKey('wd' + Math.min(weekday(today), 6))
      return
    }
    setView('week')
    setOffset(v === 'diese' ? 0 : 1)
    setOpenKey(v === 'diese' ? today : null)
  }
  const tabValue = view === 'normal' ? 'normal' : offset === 0 ? 'diese' : offset === 1 ? 'naechste' : 'keine'

  const whoEvent = (o: Occurrence) => {
    if (o.person_id) return people.find((p) => p.id === o.person_id)?.name ?? ''
    if (!o.member_id) return 'ihr beide'
    if (o.member_id === me?.id) return 'du'
    return members.find((m) => m.id === o.member_id)?.display_name ?? ''
  }

  // Kurzzeile + Unterzeile + Chips
  function rowParts(r: DayRow) {
    const main = daySummary(r.state, voice)
    const subs: string[] = []
    const a = r.state.anna_arbeit
    if (a?.value && !/^frei/i.test(a.value)) subs.push(`Anna arbeitet ${a.value.replace(/\s*std\.?$/i, ' Std.')}`)
    const dayEvents = r.events.filter((e) => !isMultiDay(e))
    if (dayEvents.length) subs.push(dayEvents.map((e) => [hhmm(e.start_time), e.title + (e.repeat ? ' ↻' : '')].filter(Boolean).join(' ')).join(' · '))
    const chips: { key: string; label: string }[] = []
    const es = r.state.abend_essen
    const bt = r.state.abend_bett
    if (es?.is_open && bt?.is_open) chips.push({ key: 'abend', label: 'Abend offen · übernehmen' })
    else if (es?.is_open) chips.push({ key: 'essen', label: 'Essen offen · übernehmen' })
    else if (bt?.is_open) chips.push({ key: 'bett', label: 'Bettgehen offen · übernehmen' })
    if (r.state.wochenende?.is_open) chips.push({ key: 'familientag', label: 'Familientag? · festlegen' })
    const multiHere = r.events.filter(isMultiDay)
    const mainText = main || (multiHere[0]?.title ?? (dayEvents[0]?.title ?? '—'))
    return { main: mainText, sub: subs.join(' · '), chips }
  }

  return (
    <div className="page" style={{ gap: 12, paddingRight: 18 }}>
      <header className="wk__head">
        {view === 'week' ? (
          <button type="button" className="wk__arrow" aria-label="Vorige Woche" onClick={() => go(-1)}>‹</button>
        ) : (
          <span style={{ width: 44 }} />
        )}
        <div className="wk__title">
          <span className="wk__range">{view === 'week' ? weekRange(monday) : 'Eine normale Woche'}</span>
          <span className="kicker" style={{ fontSize: 11 }}>{view === 'week' ? `KW ${isoWeek(monday)}` : 'Unser Wochenplan'}</span>
        </div>
        {view === 'week' ? (
          <button type="button" className="wk__arrow" aria-label="Nächste Woche" onClick={() => go(1)}>›</button>
        ) : (
          <span style={{ width: 44 }} />
        )}
      </header>

      <div className="tabs wk__tabs" role="tablist">
        {[
          { v: 'diese', label: 'Diese Woche' },
          { v: 'naechste', label: 'Nächste Woche' },
          { v: 'normal', label: 'Normalwoche' },
        ].map((t) => (
          <button key={t.v} type="button" role="tab" aria-selected={tabValue === t.v} className="tab" onClick={() => pickTab(t.v as 'diese' | 'naechste' | 'normal')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={'wk__list' + (view === 'normal' ? ' wk__list--plain' : '')} ref={listRef}>
        {view === 'week' && strips.length > 0 && (
          <div className="wk__strips" aria-hidden>
            {strips.map((s) => (
              <div key={s.id} style={{ position: 'absolute', right: 0, top: s.top, height: s.height, width: 36 }}>
                <span className="wk__strip-label" style={{ top: s.openTop ? 14 : 10 }}>{s.label}</span>
                <div className={'wk__strip' + (s.openTop ? ' wk__strip--open-top' : '') + (s.openBottom ? ' wk__strip--open-bottom' : '')} style={{ top: 0, height: '100%' }} />
                {s.openTop && <div className="wk__strip-frayed" style={{ top: 0 }} />}
                {s.openBottom && <div className="wk__strip-frayed" style={{ bottom: 0 }} />}
              </div>
            ))}
          </div>
        )}

        {rows.map((r) => {
          const isOpen = openKey === r.key
          const parts = rowParts(r)
          const lines = dayLines(r.state, voice)
          const hints = openHints(r.state)
          const changed = hasOverride(r.state)
          return (
            <div className="wk__day" key={r.key} ref={(el) => { if (r.date) rowRefs.current[r.date] = el }}>
              <div className="wk__row" style={{ cursor: 'default' }}>
                <button type="button" className="wk__row" style={{ padding: 0, minHeight: 0, flex: 1 }} onClick={() => setOpenKey(isOpen ? null : r.key)} aria-expanded={isOpen}>
                  <span className="wk__wd">
                    <span className={'wk__wd-name' + (r.isToday ? ' wk__wd-name--today' : '')}>{r.wd}</span>
                    {r.dateLabel && <span className="wk__wd-date">{r.dateLabel}</span>}
                  </span>
                  <span className="wk__main">
                    <span className="wk__line">
                      {parts.main}
                      {changed && <span className="open-dot open-dot--filled" style={{ display: 'inline-block', marginLeft: 8, transform: 'translateY(-2px)' }} aria-label="Abweichung" />}
                    </span>
                    {parts.sub && <span className="wk__sub">{parts.sub}</span>}
                  </span>
                  <Chevron open={isOpen} />
                </button>
              </div>
              {view === 'week' && parts.chips.length > 0 && !isOpen && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 50, paddingBottom: 8 }}>
                  {parts.chips.map((c) => (
                    <button key={c.key} type="button" className="wk__chip" onClick={() => setTakeover({ date: r.date!, state: r.state })}>{c.label}</button>
                  ))}
                </div>
              )}
              <Collapse open={isOpen}>
                <div className="day__body" style={{ paddingLeft: 50 }}>
                  {lines.map((l) => {
                    const isChanged = l.slots.some((s) => r.state[s]?.overridden)
                    return (
                      <button
                        type="button"
                        key={l.label}
                        className={'day__line' + (isChanged ? ' day__line--changed' : '')}
                        onClick={() => setEditSlots({ slots: l.slots.filter((s) => r.state[s] || view === 'normal'), date: r.date, weekday: view === 'normal' ? r.weekday : undefined, state: r.state })}
                      >
                        <span className="label label--small">{l.label}</span>
                        <span className="hand">{l.text}</span>
                      </button>
                    )
                  })}

                  {view === 'week' && r.events.length > 0 && (
                    <div className="stack stack--tight">
                      <span className="label label--small">Termine</span>
                      {r.events.map((e) => {
                        const past = !isMultiDay(e) && eventEnd({ date: e.occ_date, start_time: e.start_time, end_time: e.end_time }) <= now
                        return (
                          <button type="button" key={e.id + e.occ_date} className={'day__line' + (past ? ' day__line--past' : '')} style={{ minHeight: 36, padding: '2px 0' }} onClick={() => setEditEvent(events.find((x) => x.id === e.base_id) ?? null)}>
                            <span className="hand" style={{ fontSize: 20 }}>
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

                  {view === 'week' && parts.chips.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {parts.chips.map((c) => (
                        <button key={c.key} type="button" className="wk__chip" onClick={() => setTakeover({ date: r.date!, state: r.state })}>{c.label}</button>
                      ))}
                    </div>
                  )}
                  {view === 'normal' && hints.length > 0 && <span className="hint hint--brown">Offen: {hints.join(', ').replace(/[.?!]$/, '')}. Klären wir in der Sonntagsrunde.</span>}

                  {view === 'week' && r.date && (
                    <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0' }} onClick={() => nav('/neu', { state: { kind: 'termin', date: r.date } })}>
                      + Termin an diesem Tag
                    </button>
                  )}
                </div>
              </Collapse>
            </div>
          )
        })}
        <div style={{ borderTop: '1px solid var(--line-soft)' }} />
      </div>

      <p className="hint" style={{ marginTop: 6, fontSize: 13 }}>
        {view === 'normal'
          ? 'Orientierung, kein starres Regelwerk. Offenes klären wir in der Sonntagsrunde.'
          : 'Streifen rechts: was über mehrere Tage geht. ↻ wiederholt sich. Gestrichelt: noch offen, antippen zum Übernehmen.'}
      </p>

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
