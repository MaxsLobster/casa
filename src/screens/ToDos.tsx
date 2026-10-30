import { useEffect, useMemo, useState } from 'react'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, isoWeek, lastSundayCutoff, relativeLabel, shortDate, startOfWeek, toISO, weekRange, weekdayShort } from '../lib/dates'
import type { Task } from '../lib/types'
import { Check, Chevron, Collapse, Tabs } from '../components/ui'
import { TaskEditor } from './TaskEditor'

type GroupId = 'neu' | 'heute' | 'woche' | 'spaeter' | 'geschafft'
const GROUP_TITLE: Record<GroupId, string> = { neu: 'Neu', heute: 'Heute fällig', woche: 'Diese Woche', spaeter: 'Später', geschafft: 'Geschafft diese Woche' }

export function ToDos() {
  const { me, members, tasks, setTaskDone, isNew, markSeen } = useCasa()
  const today = useToday()
  const now = useNow()
  const partners = members.filter((m) => m.role === 'partner')
  const tabs = [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'alle', label: 'Alle' }]
  const [tab, setTab] = useState<string>(me?.id ?? 'alle')
  const [editing, setEditing] = useState<Task | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const cutoff = useMemo(() => lastSundayCutoff(now).toISOString(), [now])
  const sunday = addDays(startOfWeek(today), 6)
  const inTab = (t: Task) => tab === 'alle' || t.owner_member_id === tab
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? ''

  // NEU bleibt sichtbar, solange die Liste offen ist
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const fresh = tasks.filter((t) => inTab(t) && t.status !== 'erledigt' && isNew('task', t)).map((t) => t.id)
    if (fresh.length === 0) return
    setNewIds((prev) => new Set([...prev, ...fresh]))
    const timer = setTimeout(() => markSeen('task', fresh), 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tab])

  const groups = useMemo(() => {
    const g: Record<GroupId, Task[]> = { neu: [], heute: [], woche: [], spaeter: [], geschafft: [] }
    for (const t of tasks) {
      if (!inTab(t)) continue
      if (t.status === 'erledigt') {
        if ((t.done_at ?? '') >= cutoff) g.geschafft.push(t)
        continue
      }
      if (newIds.has(t.id)) g.neu.push(t)
      else if (t.due_date <= today) g.heute.push(t)
      else if (t.due_date <= sunday) g.woche.push(t)
      else g.spaeter.push(t)
    }
    const byDue = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at)
    g.neu.sort(byDue)
    g.heute.sort(byDue)
    g.woche.sort(byDue)
    g.spaeter.sort(byDue)
    g.geschafft.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tab, today, sunday, cutoff, newIds])

  const archive = useMemo(() => {
    const old = tasks.filter(inTab).filter((t) => t.status === 'erledigt' && t.done_at && t.done_at < cutoff)
    const map = new Map<string, Task[]>()
    for (const t of old) {
      const monday = startOfWeek(toISO(new Date(t.done_at!)))
      map.set(monday, [...(map.get(monday) ?? []), t])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([monday, items]) => ({ monday, items: items.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tab, cutoff])
  const archiveCount = archive.reduce((n, g) => n + g.items.length, 0)

  const meta = (t: Task, done: boolean) => {
    if (done) return t.done_at ? weekdayShort(toISO(new Date(t.done_at))) : 'erledigt'
    const parts = [relativeLabel(t.due_date, today)]
    if (t.status === 'zugesagt') parts.unshift('zugesagt')
    if (t.status === 'geparkt') parts.unshift('geparkt')
    const actor = t.updated_by ?? t.created_by
    if (actor && actor !== t.owner_member_id && newIds.has(t.id)) parts.push(`von ${nameOf(actor)}`)
    if (tab === 'alle') parts.push(nameOf(t.owner_member_id))
    if (t.repeat) parts.push('↻')
    return parts.join(' · ')
  }

  const total = (['neu', 'heute', 'woche', 'spaeter', 'geschafft'] as GroupId[]).reduce((n, k) => n + groups[k].length, 0)

  return (
    <div className="page" style={{ gap: 14 }}>
      <h1 className="h1">To-Dos</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {total === 0 && <p className="hint" style={{ paddingTop: 8 }}>Nichts offen. Schön.</p>}

      {(['neu', 'heute', 'woche', 'spaeter', 'geschafft'] as GroupId[]).map((k) =>
        groups[k].length === 0 ? null : (
          <section key={k} className="stack" style={{ gap: 0 }}>
            <h2 className="heute__h2" style={{ margin: '6px 0 2px' }}>{GROUP_TITLE[k]}</h2>
            {groups[k].map((t) => {
              const done = t.status === 'erledigt'
              return (
                <div className="todo" key={t.id}>
                  <Check done={done} onToggle={() => setTaskDone(t.id, !done)} label={done ? 'Wieder öffnen' : 'Erledigt'} />
                  <button type="button" className="task__body" onClick={() => setEditing(t)}>
                    <span className={'task__title' + (done ? ' task__title--done' : '')} style={{ lineHeight: 1.1 }}>{t.title}</span>
                    <span className="task__meta" style={{ flexWrap: 'wrap' }}>
                      <span className="heute__sub">{meta(t, done)}</span>
                      {!done && newIds.has(t.id) && <span className="stamp stamp--new">Neu</span>}
                    </span>
                  </button>
                </div>
              )
            })}
          </section>
        ),
      )}

      <div className="spacer" />

      {archiveCount > 0 && (
        <div className="stack stack--tight" style={{ alignItems: 'center' }}>
          <button type="button" className="link link--hand" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setArchiveOpen((o) => !o)} aria-expanded={archiveOpen}>
            {archiveOpen ? 'Erledigt ausblenden' : 'Erledigt ansehen →'}
            {archiveOpen && <Chevron open />}
          </button>
          <Collapse open={archiveOpen}>
            <div className="stack" style={{ gap: 14, paddingBottom: 8, width: '100%' }}>
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
                        {tab === 'alle' ? `${nameOf(t.owner_member_id)} · ` : ''}
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
