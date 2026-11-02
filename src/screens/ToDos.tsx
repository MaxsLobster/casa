import { useEffect, useMemo, useState } from 'react'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { addDays, isoWeek, lastSundayCutoff, relativeLabel, shortDate, startOfWeek, toISO, weekRange, weekdayShort } from '../lib/dates'
import type { Task } from '../lib/types'
import { Check, Chevron, Collapse } from '../components/ui'
import { TaskEditor } from './TaskEditor'
import { awayOn } from '../lib/effects'
import { dueLabel } from '../lib/anchors'
import { useArea } from '../state/area'
import { IdeenGruppe } from '../mwf/Ideen'

type GroupId = 'offen' | 'liegt' | 'neu' | 'heute' | 'woche' | 'spaeter' | 'geschafft'
const GROUP_ORDER: GroupId[] = ['offen', 'liegt', 'neu', 'heute', 'woche', 'spaeter', 'geschafft']
const GROUP_TITLE: Record<GroupId, string> = { offen: 'Offen – wer übernimmt?', liegt: 'Liegt noch', neu: 'Neu', heute: 'Heute fällig', woche: 'Diese Woche', spaeter: 'Später', geschafft: 'Geschafft diese Woche' }
// Standard: Liegt noch, Neu und Heute offen, der Rest zu. Zustand pro Gerät.
const DEFAULT_OPEN: Record<GroupId, boolean> = { offen: true, liegt: true, neu: true, heute: true, woche: false, spaeter: false, geschafft: false }
const STORAGE_KEY = 'casa.todoGroups'

function readOpen(): Record<GroupId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_OPEN, ...(JSON.parse(raw) as Partial<Record<GroupId, boolean>>) }
  } catch {
    /* egal */
  }
  return { ...DEFAULT_OPEN }
}

export function ToDos() {
  const { me, members, tasks: allTasks, events, anchors, setTaskDone, takeTask, isNew, markSeen } = useCasa()
  const area = useArea()
  const tasks = useMemo(() => allTasks.filter((t) => t.area === area), [allTasks, area])
  const anchorName = (id: string | null) => (id ? anchors.find((a) => a.id === id)?.title ?? null : null)
  const today = useToday()
  const now = useNow()
  const [editing, setEditing] = useState<Task | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [open, setOpen] = useState<Record<GroupId, boolean>>(readOpen)

  function toggle(k: GroupId) {
    setOpen((o) => {
      const next = { ...o, [k]: !o[k] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* egal */
      }
      return next
    })
  }

  const cutoff = useMemo(() => lastSundayCutoff(now).toISOString(), [now])
  const sunday = addDays(startOfWeek(today), 6)
  const mine = (t: Task) => t.owner_member_id === me?.id
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? ''

  // NEU bleibt sichtbar, solange die Liste offen ist
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const fresh = tasks.filter((t) => mine(t) && t.status !== 'erledigt' && isNew('task', t)).map((t) => t.id)
    if (fresh.length === 0) return
    setNewIds((prev) => new Set([...prev, ...fresh]))
    const timer = setTimeout(() => markSeen('task', fresh), 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, me?.id])

  const groups = useMemo(() => {
    const g: Record<GroupId, Task[]> = { offen: [], liegt: [], neu: [], heute: [], woche: [], spaeter: [], geschafft: [] }
    for (const t of tasks) {
      if (t.status !== 'erledigt' && t.owner_member_id === null) {
        g.offen.push(t)
        continue
      }
      if (t.status === 'erledigt') {
        // Geschafft: meine und die des anderen
        if ((t.done_at ?? '') >= cutoff) g.geschafft.push(t)
        continue
      }
      if (!mine(t)) continue
      if (t.due_date < today) g.liegt.push(t)
      else if (newIds.has(t.id)) g.neu.push(t)
      else if (t.due_date === today) g.heute.push(t)
      else if (t.due_date <= sunday) g.woche.push(t)
      else g.spaeter.push(t)
    }
    const byDue = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at)
    for (const k of ['offen', 'liegt', 'neu', 'heute', 'woche', 'spaeter'] as GroupId[]) g[k].sort(byDue)
    g.geschafft.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, me?.id, today, sunday, cutoff, newIds])

  const archive = useMemo(() => {
    const old = tasks.filter((t) => t.status === 'erledigt' && t.done_at && t.done_at < cutoff)
    const map = new Map<string, Task[]>()
    for (const t of old) {
      const monday = startOfWeek(toISO(new Date(t.done_at!)))
      map.set(monday, [...(map.get(monday) ?? []), t])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([monday, items]) => ({ monday, items: items.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')) }))
  }, [tasks, cutoff])
  const archiveCount = archive.reduce((n, g) => n + g.items.length, 0)

  const meta = (t: Task, done: boolean) => {
    if (done) {
      const parts = [t.done_at ? weekdayShort(toISO(new Date(t.done_at))) : 'erledigt']
      if (!mine(t)) parts.push(nameOf(t.owner_member_id))
      return parts.join(' · ')
    }
    const parts = [relativeLabel(t.due_date, today)]
    if (t.status === 'zugesagt') parts.unshift('zugesagt')
    if (t.status === 'geparkt') parts.unshift('geparkt')
    const actor = t.updated_by ?? t.created_by
    if (actor && actor !== t.owner_member_id && newIds.has(t.id)) parts.push(`von ${nameOf(actor)}`)
    if (t.repeat) parts.push('↻')
    return parts.join(' · ')
  }

  const total = GROUP_ORDER.reduce((n, k) => n + groups[k].length, 0)

  return (
    <div className="page" style={{ gap: 6 }}>
      <h1 className="h1" style={{ marginBottom: 8 }}>To-Dos</h1>

      {area === 'mwf' && <IdeenGruppe />}

      {total === 0 && <p className="hint" style={{ paddingTop: 8 }}>Nichts offen. Schön.</p>}

      {GROUP_ORDER.map((k) =>
        groups[k].length === 0 ? null : (
          <section key={k} className="stack" style={{ gap: 0 }}>
            <button type="button" className="todo-group__head" onClick={() => toggle(k)} aria-expanded={open[k]}>
              <span className="todo-group__title">{GROUP_TITLE[k]}</span>
              <span className="todo-group__count">{groups[k].length}</span>
              <Chevron open={open[k]} />
            </button>
            <Collapse open={open[k]}>
              <div className="stack" style={{ gap: 0, paddingBottom: 6 }}>
                {k === 'offen' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0 4px' }}>
                    {groups.offen.map((t) => (
                      <button key={t.id} type="button" className="wk__chip" style={{ textAlign: 'left' }} onClick={() => takeTask(t.id)} aria-label={`${t.title} übernehmen`}>
                        {t.title} · {dueLabel(t.due_date, today)} · übernehmen
                        {anchorName(t.anchor_id) && <span className="ank__tag" style={{ marginLeft: 8, fontFamily: 'var(--font-ui)' }}>{anchorName(t.anchor_id)}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {k !== 'offen' && groups[k].map((t) => {
                  const done = t.status === 'erledigt'
                  return (
                    <div className="todo" key={t.id}>
                      {t.is_running ? <span className="check" aria-hidden><span className="mwf__running" /></span> : <Check done={done} onToggle={() => setTaskDone(t.id, !done)} label={done ? 'Wieder öffnen' : 'Erledigt'} />}
                      <button type="button" className="task__body" onClick={() => setEditing(t)}>
                        <span className={'task__title' + (done ? ' task__title--done' : '')} style={{ lineHeight: 1.1 }}>{t.title}</span>
                        <span className="task__meta" style={{ flexWrap: 'wrap' }}>
                          <span className="heute__sub">{meta(t, done)}</span>
                          {t.anchor_id && anchorName(t.anchor_id) && <span className="ank__tag">{anchorName(t.anchor_id)}</span>}
                          {t.fair_id && <span className="mwf__tag">Runde</span>}
                          {t.is_yearly && <span className="mwf__tag">Jahr</span>}
                          {!done && newIds.has(t.id) && <span className="stamp stamp--new">Neu</span>}
                          {!done && t.owner_member_id && awayOn(events, t.owner_member_id, t.due_date) && (
                            <span className="hint hint--brown" style={{ width: '100%' }}>{mine(t) ? 'Du bist da weg' : `${nameOf(t.owner_member_id)} ist da weg`} – trotzdem {mine(t) ? 'bei dir' : 'dort'} lassen?</span>
                          )}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </Collapse>
          </section>
        ),
      )}

      <div className="spacer" />

      {archiveCount > 0 && (
        <div className="stack stack--tight" style={{ alignItems: 'center', paddingTop: 12 }}>
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
                      <button type="button" className="row__text hand" style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: 'var(--ink-soft)', fontSize: 23, cursor: 'pointer' }} onClick={() => setEditing(t)}>
                        {t.title}
                      </button>
                      <span className="hand hand--meta">
                        {!mine(t) ? `${nameOf(t.owner_member_id)} · ` : ''}
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
