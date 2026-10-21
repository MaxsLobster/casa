import { useMemo, useState } from 'react'
import { useCasa, useToday } from '../state/HouseholdContext'
import { addDays, stampDate } from '../lib/dates'
import type { Task, TaskStatus } from '../lib/types'
import { Check, Stamp, Tabs } from '../components/ui'
import { TaskEditor } from './TaskEditor'

export function Offen() {
  const { me, members, tasks, setTaskDone } = useCasa()
  const today = useToday()
  const partners = members.filter((m) => m.role === 'partner')
  const tabs = [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'alle', label: 'Alle' }]
  const [tab, setTab] = useState<string>(me?.id ?? 'alle')
  const [editing, setEditing] = useState<Task | null>(null)

  const list = useMemo(() => {
    const cutoff = addDays(today, -14)
    return tasks
      .filter((t) => tab === 'alle' || t.owner_member_id === tab)
      .filter((t) => t.status !== 'erledigt' || (t.done_at ?? '').slice(0, 10) >= cutoff)
      .sort((a, b) => {
        const da = a.status === 'erledigt' ? 1 : 0
        const db = b.status === 'erledigt' ? 1 : 0
        if (da !== db) return da - db
        if (da) return (b.done_at ?? '').localeCompare(a.done_at ?? '')
        return a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at)
      })
  }, [tasks, tab, today])

  return (
    <div className="page" style={{ gap: 14 }}>
      <header className="stack stack--tight">
        <span className="kicker">Was gerade läuft</span>
        <h1 className="h1">Offen</h1>
      </header>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div>
        {list.length === 0 && <p className="hint" style={{ paddingTop: 8 }}>Nichts offen. Schön.</p>}
        {list.map((t) => {
          const done = t.status === 'erledigt'
          return (
            <div className="task" key={t.id}>
              <Check done={done} onToggle={() => setTaskDone(t.id, !done)} label={done ? 'Wieder öffnen' : 'Erledigt'} />
              <button type="button" className="task__body" onClick={() => setEditing(t)}>
                <span className={'task__title' + (done ? ' task__title--done' : '')}>{t.title}</span>
                <span className="task__meta">
                  <Stamp status={t.status}>{stampLabel(t, today)}</Stamp>
                  {tab === 'alle' && <span className="task__owner">{members.find((m) => m.id === t.owner_member_id)?.display_name}</span>}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function stampLabel(t: Task, today: string): string {
  const d = stampDate(t.due_date, today)
  const map: Record<TaskStatus, string> = {
    offen: t.due_date === today ? 'Heute' : t.due_date === addDays(today, 1) ? 'Morgen' : `Bis ${d}`,
    zugesagt: `Zugesagt · ${d}`,
    geparkt: `Geparkt · ${d}`,
    erledigt: 'Erledigt',
  }
  return map[t.status]
}
