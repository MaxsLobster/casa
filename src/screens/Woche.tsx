import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { addDays, hhmm, isoWeek, startOfWeek, weekDates, weekRange, weekday, weekdayShort, weekdayShortByIndex } from '../lib/dates'
import { dayLines, daySummary, dayState, hasOpen, hasOverride, openHints, templateState, type DayState, type Voice } from '../lib/week'
import type { Event, Slot } from '../lib/types'
import { Chevron, Collapse, Tabs } from '../components/ui'
import { SlotEditor } from './SlotEditor'
import { EventEditor } from './EventEditor'

type View = 'diese' | 'normal'

export function Woche() {
  const { me, members, normalWeek, overrides, events } = useCasa()
  const today = useToday()
  const nav = useNavigate()
  const [view, setView] = useState<View>('diese')
  const [openKey, setOpenKey] = useState<string | null>(today)
  const [editSlots, setEditSlots] = useState<{ slots: Slot[]; date?: string; weekday?: number; state: DayState } | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)

  const voice: Voice = { me, members }
  const monday = startOfWeek(today)
  const dates = weekDates(monday)

  const thisWeek = useMemo(
    () =>
      dates.map((d) => {
        const st = dayState(d, normalWeek, overrides)
        return { key: d, date: d, wd: weekdayShort(d), state: st, events: events.filter((e) => e.date === d).sort(byTime), isToday: d === today }
      }),
    [dates, normalWeek, overrides, events, today],
  )

  // Normalwoche: Mo–Fr einzeln, Wochenende als eine Zeile (weekday 6)
  const template = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((wd) => ({
        key: 'wd' + wd,
        weekday: wd,
        wd: wd === 6 ? 'Sa So' : weekdayShortByIndex(wd),
        state: templateState(wd, normalWeek),
        events: [] as Event[],
        isToday: false,
        date: undefined as string | undefined,
      })),
    [normalWeek],
  )

  const rows = view === 'diese' ? thisWeek : template

  function pick(v: View) {
    setView(v)
    setOpenKey(v === 'diese' ? today : 'wd' + Math.min(weekday(today), 6))
  }

  return (
    <div className="page" style={{ gap: 0 }}>
      <header className="stack stack--tight" style={{ paddingBottom: 8 }}>
        <span className="kicker">{view === 'diese' ? `Woche ${isoWeek(monday)} · ${weekRange(monday)}` : 'Unser Wochenplan'}</span>
        <h1 className="h1">{view === 'diese' ? 'Eure Woche' : 'Eine normale Woche'}</h1>
      </header>

      <div style={{ marginBottom: 6 }}>
        <Tabs
          tabs={[
            { value: 'diese' as View, label: 'Diese Woche' },
            { value: 'normal' as View, label: 'Normalwoche' },
          ]}
          value={view}
          onChange={pick}
        />
      </div>

      {rows.map((r) => {
        const isOpen = openKey === r.key
        const lines = dayLines(r.state, voice)
        const hints = openHints(r.state)
        const open = hasOpen(r.state)
        const changed = hasOverride(r.state)
        return (
          <div className="day" key={r.key}>
            <button type="button" className="day__head" onClick={() => setOpenKey(isOpen ? null : r.key)} aria-expanded={isOpen}>
              <span className={'day__wd' + (r.isToday ? ' day__wd--today' : '')}>{r.wd}</span>
              <span className="day__summary">{daySummary(r.state, voice) || (r.events.length ? r.events.map((e) => e.title).join(' · ') : '—')}</span>
              {(open || changed) && <span className={'open-dot' + (changed && !open ? ' open-dot--filled' : '')} aria-label={open ? 'Offener Punkt' : 'Abweichung'} />}
              <Chevron open={isOpen} />
            </button>
            <Collapse open={isOpen}>
              <div className="day__body">
                {lines.map((l) => {
                  const isChanged = l.slots.some((s) => r.state[s]?.overridden)
                  return (
                    <button
                      type="button"
                      key={l.label}
                      className={'day__line' + (isChanged ? ' day__line--changed' : '')}
                      onClick={() => setEditSlots({ slots: l.slots.filter((s) => r.state[s] || view === 'normal'), date: r.date, weekday: 'weekday' in r ? r.weekday : undefined, state: r.state })}
                    >
                      <span className="label label--small">{l.label}</span>
                      <span className="hand">{l.text}</span>
                    </button>
                  )
                })}

                {view === 'diese' && r.events.length > 0 && (
                  <div className="stack stack--tight">
                    <span className="label label--small">Termine</span>
                    {r.events.map((e) => (
                      <button type="button" key={e.id} className="day__line" style={{ minHeight: 36, padding: '2px 0' }} onClick={() => setEditEvent(e)}>
                        <span className="hand" style={{ fontSize: 20 }}>
                          {[hhmm(e.start_time), e.title].filter(Boolean).join(' ')}
                          <span className="hand hand--meta" style={{ marginLeft: 8 }}>{whoLabel(e.member_id, voice)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {hints.length > 0 && (
                  <span className="hint hint--brown">Offen: {hints.join(', ').replace(/[.?!]$/, '')}. Klären wir in der Sonntagsrunde.</span>
                )}

                {view === 'diese' && r.date && (
                  <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0' }} onClick={() => nav('/neu', { state: { kind: 'termin', date: r.date } })}>
                    + Termin an diesem Tag
                  </button>
                )}
              </div>
            </Collapse>
          </div>
        )
      })}

      {view === 'normal' && (
        <p className="hint" style={{ marginTop: 14 }}>Orientierung, kein starres Regelwerk. Offenes klären wir in der Sonntagsrunde.</p>
      )}
      {view === 'diese' && (
        <p className="hint" style={{ marginTop: 14 }}>Tipp auf eine Zeile, um für diesen Tag etwas anderes einzutragen.</p>
      )}

      {editSlots && (
        <SlotEditor
          slots={editSlots.slots}
          date={editSlots.date}
          weekday={editSlots.weekday}
          state={editSlots.state}
          onClose={() => setEditSlots(null)}
        />
      )}
      {editEvent && <EventEditor event={editEvent} onClose={() => setEditEvent(null)} />}
    </div>
  )
}

function byTime(a: Event, b: Event) {
  return (a.start_time ?? '99').localeCompare(b.start_time ?? '99')
}

export function whoLabel(memberId: string | null, v: Voice): string {
  if (!memberId) return 'ihr beide'
  if (memberId === v.me?.id) return 'du'
  return v.members.find((m) => m.id === memberId)?.display_name ?? ''
}

export { addDays }
