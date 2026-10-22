import { useMemo, useState } from 'react'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, isoWeek, lastSundayCutoff, shortDate, stampDate, startOfWeek, toISO, weekRange } from '../lib/dates'
import type { Task, TaskStatus } from '../lib/types'
import { Check, Chevron, Collapse, Stamp, Tabs } from '../components/ui'
import { TaskEditor } from './TaskEditor'

export function Offen() {
  const { me, members, tasks, setTaskDone } = useCasa()
  const today = useToday()
  const now = useNow()
  const partners = members.filter((m) => m.role === 'partner')
  const tabs = [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'alle', label: 'Alle' }]
  const [tab, setTab] = useState<string>(me?.id ?? 'alle')
  const [editing, setEditing] = useState<Task | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Erledigtes bleibt bis Sonntag 20 Uhr sichtbar, danach nur noch im Archiv.
  const cutoff = useMemo(() => lastSundayCutoff(now).toISOString(), [now])

  const inTab = (t: Task) => tab === 'alle' || t.owner_member_id === tab

  const list = useMemo(
    () =>
      tasks
        .filter(inTab)
        .filter((t) => t.status !== 'erledigt' || (t.done_at ?? '') >= cutoff)
        .sort((a, b) => {
          const da = a.status === 'erledigt' ? 1 : 0
          const db = b.status === 'erledigt' ? 1 : 0
          if (da !== db) return da - db
          if (da) return (b.done_at ?? '').localeCompare(a.done_at ?? '')
          return a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at)
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, tab, cutoff],
  )

  // Archiv: früher Erledigtes, nach Woche gruppiert (neueste zuerst)
  const archive = useMemo(() => {
    const old = tasks.filter(inTab).filter((t) => t.status === 'erledigt' && t.done_at && t.done_at < cutoff)
    const groups = new Map<string, Task[]>()
    for (const t of old) {
      const monday = startOfWeek(toISO(new Date(t.done_at!)))
      groups.set(monday, [...(groups.get(monday) ?? []), t])
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monday, items]) => ({ monday, items: items.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tab, cutoff])
  const archiveCount = archive.reduce((n, g) => n + g.items.length, 0)

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

      <div className="spacer" />

      {archiveCount > 0 && (
        <div className="stack stack--tight">
          <button type="button" className="link" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setArchiveOpen((o) => !o)} aria-expanded={archiveOpen}>
            {archiveOpen ? 'Erledigt ausblenden' : 'Erledigt ansehen'}
            <Chevron open={archiveOpen} />
          </button>
          <Collapse open={archiveOpen}>
            <div className="stack" style={{ gap: 14, paddingBottom: 8 }}>
              {archive.map((g) => (
                <div key={g.monday} className="stack" style={{ gap: 4 }}>
                  <span className="label label--small">KW {isoWeek(g.monday)} · {weekRange(g.monday)}</span>
                  {g.items.map((t) => (
                    <div className="row" key={t.id}>
                      <span className="row__mark" style={{ color: 'var(--green)' }}>✓</span>
                      <button type="button" className="row__text hand" style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: 'var(--ink-soft)', fontSize: 21, cursor: 'pointer' }} onClick={() => setEditing(t)}>
                        {t.title}
                      </button>
                      <span className="hand hand--meta">
                        {tab === 'alle' ? `${members.find((m) => m.id === t.owner_member_id)?.display_name ?? ''} · ` : ''}
                        {shortDate(toISO(new Date(t.done_at!)))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Collapse>
        </div>
      )}

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
