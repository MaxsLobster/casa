import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { eventEnd, headline, hhmm, lastSundayCutoff, relativeLabel } from '../lib/dates'
import { abendLine, dayState, openHints, valerieLine, type Voice } from '../lib/week'
import { Check, Chevron, Collapse } from '../components/ui'
import type { Task } from '../lib/types'

type SectionId = 'termine' | 'dich' | 'partner' | 'geschafft'

export function Heute() {
  const casa = useCasa()
  const today = useToday()
  const now = useNow()
  const { me, partner, members, tasks, events, normalWeek, overrides } = casa
  const [open, setOpen] = useState<SectionId | null>('dich')

  const voice: Voice = { me, members }
  const day = useMemo(() => dayState(today, normalWeek, overrides), [today, normalWeek, overrides])
  const v1 = valerieLine(day, voice, false)
  const a1 = abendLine(day, voice)
  const line1 = day.wochenende ? `Wochenende: ${day.wochenende.value ?? ''}` : v1 ? `Valerie: ${v1}` : null
  const line2 = day.wochenende ? null : a1 ? `Abend: ${a1}` : null
  const title = headline(today)
  const hints = openHints(day)

  // Erledigtes zählt bis zur Sonntagsrunde (Sonntag 20 Uhr) zur laufenden Woche
  const cutoff = lastSundayCutoff(now).toISOString()

  // Vergangene Termine verschwinden, sobald ihre Endzeit vorbei ist
  const todaysEvents = events
    .filter((e) => e.date === today && eventEnd(e) > now)
    .sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
  const mine = tasks.filter((t) => t.owner_member_id === me?.id && t.status !== 'erledigt').sort(byDue)
  const theirs = tasks.filter((t) => partner && t.owner_member_id === partner.id && t.status !== 'erledigt').sort(byDue)
  const done = tasks
    .filter((t) => t.status === 'erledigt' && t.done_at && t.done_at >= cutoff)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  const nameOf = (id: string | null) => {
    if (!id) return 'ihr beide'
    if (id === me?.id) return 'du'
    return members.find((m) => m.id === id)?.display_name ?? ''
  }

  const toggle = (id: SectionId) => setOpen((o) => (o === id ? null : id))

  const sections: { id: SectionId; title: string; count: string; body: React.ReactNode }[] = [
    {
      id: 'termine',
      title: 'Termine heute',
      count: String(todaysEvents.length),
      body: todaysEvents.length ? (
        todaysEvents.map((e) => (
          <div className="row" key={e.id}>
            <span className="row__mark">·</span>
            <span className="row__text hand hand--navy">{[hhmm(e.start_time), e.title].filter(Boolean).join(' ')}</span>
            <span className="hand hand--meta">{nameOf(e.member_id)}</span>
          </div>
        ))
      ) : (
        <p className="hint">Heute steht nichts (mehr) an.</p>
      ),
    },
    {
      id: 'dich',
      title: 'Für dich',
      count: String(mine.length),
      body: mine.length ? mine.map((t) => <TaskRow key={t.id} task={t} today={today} />) : <p className="hint">Nichts offen. Schön.</p>,
    },
    {
      id: 'partner',
      title: partner ? `Bei ${partner.display_name}` : 'Beim anderen',
      count: String(theirs.length),
      body: theirs.length ? theirs.map((t) => <TaskRow key={t.id} task={t} today={today} />) : <p className="hint">Nichts offen.</p>,
    },
    {
      id: 'geschafft',
      title: 'Geschafft diese Woche',
      count: `${done.length} ✓`,
      body: done.length ? (
        done.map((t) => (
          <div className="row" key={t.id}>
            <span className="row__mark">✓</span>
            <span className="row__text hand" style={{ color: 'var(--ink-soft)' }}>{t.title}</span>
            <span className="hand hand--meta">{members.find((m) => m.id === t.owner_member_id)?.display_name}</span>
          </div>
        ))
      ) : (
        <p className="hint">Diese Woche noch nichts abgehakt.</p>
      ),
    },
  ]

  return (
    <div className="page" style={{ gap: 22 }}>
      <header>
        <h1 className={'h1' + (title.length > 21 ? ' h1--long' : '')}>{title}</h1>
      </header>

      {/* Platz für den Klebezettel mit offenen Fragen (Phase 2) */}

      <div className="stack stack--tight">
        {line1 && (
          <div className="row">
            <span className="bullet" />
            <span className="row__text hand">{line1}</span>
          </div>
        )}
        {line2 && (
          <div className="row">
            <span className="bullet bullet--hollow" />
            <span className="row__text hand">{line2}</span>
          </div>
        )}
        {hints.length > 0 && <p className="hint hint--brown" style={{ paddingLeft: 18 }}>Offen: {hints.join(' · ')}</p>}
      </div>

      <div>
        {sections.map((s) => {
          const isOpen = open === s.id
          return (
            <section className="section" key={s.id}>
              <button type="button" className="section__head" onClick={() => toggle(s.id)} aria-expanded={isOpen}>
                <span className="section__title">{s.title}</span>
                <span className="section__count">{s.count}</span>
                <Chevron open={isOpen} />
              </button>
              <Collapse open={isOpen}>
                <div className="stack" style={{ gap: 6, padding: '0 0 16px 2px' }}>{s.body}</div>
              </Collapse>
            </section>
          )
        })}
      </div>

      <div className="spacer" />
      <Link to="/einstellungen" className="link" style={{ alignSelf: 'flex-start' }}>
        Einstellungen
      </Link>
    </div>
  )
}

function byDue(a: Task, b: Task) {
  return a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at)
}

function TaskRow({ task, today }: { task: Task; today: string }) {
  const { setTaskDone } = useCasa()
  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <span style={{ marginLeft: -2, transform: 'scale(0.82)', transformOrigin: 'left center', width: 18, flex: 'none' }}>
        <Check done={false} onToggle={() => setTaskDone(task.id, true)} label={`${task.title} abhaken`} />
      </span>
      <span className="row__text hand hand--navy">{task.title}</span>
      <span className="hand hand--meta">{relativeLabel(task.due_date, today)}</span>
    </div>
  )
}
