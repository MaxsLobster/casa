// MWF-Hub: nächste Messe, Fortschritt der Runde, „Für dich", angeheftete Firmen-Anker
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import type { Task } from '../lib/types'
import { addDays } from '../lib/dates'
import { dueLabel, isResting } from '../lib/anchors'
import { fairLabel, isDone, MWF_NAME, nextFair, roundProgress, roundTasks, untilLabel } from '../lib/mwf'
import { Check } from '../components/ui'
import { TaskEditor } from '../screens/TaskEditor'
import { Band } from './Band'

export function Hub() {
  const { me, tasks, anchors, pins, fairs, setTaskDone } = useCasa()
  const today = useToday()
  const now = useNow()
  const [editing, setEditing] = useState<Task | null>(null)

  const fair = useMemo(() => nextFair(fairs, today), [fairs, today])
  const round = useMemo(() => (fair ? roundTasks(tasks, fair.id) : []), [tasks, fair])
  const progress = roundProgress(round)

  // Für dich: meine offenen MWF-Aufgaben bis zur Messe, Jahrespunkte der nächsten 30 Tage
  const mine = useMemo(() => {
    const horizon = addDays(today, 30)
    const isMine = (t: Task) => t.owner_member_id === me?.id || t.owner_member_id === null
    return tasks
      .filter((t) => t.area === 'mwf' && t.status !== 'erledigt' && isMine(t))
      .filter((t) => (fair && t.fair_id === fair.id) || (t.is_yearly ? t.due_date <= horizon : !t.fair_id && (!fair || t.due_date <= fair.date)))
      .sort((a, b) => (a.is_running ? 1 : 0) - (b.is_running ? 1 : 0) || a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at))
  }, [tasks, me?.id, fair, today])
  // Nur echte Erledigungen, keine Altlasten
  const doneCount = round.filter((t) => isDone(t) && (t.owner_member_id === me?.id || t.owner_member_id === null)).length

  const pinned = anchors.filter((a) => a.area === 'mwf' && pins.has(a.id) && !a.archived_at).sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="mwf__screen">
      <Band>
        <div className="stack" style={{ gap: 2, marginTop: 14 }}>
          <span className="mwf__kicker">{MWF_NAME}</span>
          {fair ? (
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="mwf__big">{fairLabel(fair.date)}</span>
              <span className="mwf__gold">{untilLabel(fair.date, today)}</span>
            </span>
          ) : (
            <span className="mwf__big">Keine Messe eingetragen</span>
          )}
        </div>
        {fair && progress.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div className="mwf__bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="mwf__bar-fill" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
            <span className="mwf__dim">{progress.done} von {progress.total}</span>
          </div>
        )}
      </Band>

      <main className="page mwf__main">
        <span className="todo-group__title">Für dich</span>
        <div className="stack" style={{ gap: 0 }}>
          {mine.length === 0 && <p className="hint" style={{ paddingTop: 6 }}>Nichts offen bis zur Messe. Schön.</p>}
          {mine.map((t) => (
            <div className="mwf__row" key={t.id}>
              {t.is_running ? (
                <span className="check" aria-hidden><span className="mwf__running" /></span>
              ) : (
                <Check done={false} onToggle={() => setTaskDone(t.id, true)} label={`${t.title} abhaken`} />
              )}
              <button type="button" className="task__body" style={{ padding: '4px 0' }} onClick={() => setEditing(t)}>
                <span className="task__title" style={{ fontSize: 24, lineHeight: 1.12 }}>{t.title}</span>
                <span className="heute__sub">
                  {t.is_running ? 'laufend bis zur Messe' : dueLabel(t.due_date, today)}
                  {t.owner_member_id === null && ' · beide'}
                  {t.is_yearly && ' · Jahr'}
                </span>
              </button>
            </div>
          ))}
        </div>
        {fair && doneCount > 0 && <span className="hint" style={{ fontSize: 13 }}>{doneCount === 1 ? '1 erledigt diese Runde' : `${doneCount} erledigt diese Runde`}</span>}

        <div className="spacer" />

        {pinned.length > 0 && (
          <div className="ank__chips" style={{ paddingTop: 16 }}>
            {pinned.map((a) => (
              <Link key={a.id} to={'/mwf/anker/' + a.id} className="ank__chip">
                <span style={{ color: 'var(--gold)' }} aria-hidden>⚓︎</span>
                {a.title}
                {isResting(a, now) && <span className="ank__dot" role="img" aria-label="ruht" />}
              </Link>
            ))}
          </div>
        )}
      </main>

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
