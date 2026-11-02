// MWF-Checkliste: senkrechte Zeitleiste der Runde (Montag nach der letzten Messe bis Messetag)
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { Task } from '../lib/types'
import { addDays, startOfWeek } from '../lib/dates'
import { dueLabel } from '../lib/anchors'
import { fairLabel, nextFair, roundStart, roundTasks, timelineRows, type TimelineRow } from '../lib/mwf'
import { Check } from '../components/ui'
import { TaskEditor } from '../screens/TaskEditor'
import { Band } from './Band'

const KEY_MINE = 'casa.mwf.onlyMine'
const SWIPE_MIN = 60

export function Checkliste() {
  const { me, tasks, fairs, template, members, setTaskDone } = useCasa()
  const today = useToday()
  const nav = useNavigate()
  const sorted = useMemo(() => [...fairs].sort((a, b) => a.date.localeCompare(b.date)), [fairs])
  const current = useMemo(() => {
    const n = nextFair(sorted, today)
    const i = n ? sorted.findIndex((f) => f.id === n.id) : sorted.length - 1
    return Math.max(0, i)
  }, [sorted, today])
  const [idx, setIdx] = useState(current)
  const fair = sorted[idx] ?? null
  const [onlyMine, setOnlyMine] = useState(() => {
    try {
      return localStorage.getItem(KEY_MINE) === '1'
    } catch {
      return false
    }
  })
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  function toggleMine() {
    setOnlyMine((v) => {
      try {
        localStorage.setItem(KEY_MINE, v ? '0' : '1')
      } catch {
        /* egal */
      }
      return !v
    })
  }

  const start = fair ? roundStart(sorted, fair) : null
  const isCurrent = !!fair && !!start && today >= start && today <= fair.date
  const isPast = !!fair && fair.date < today
  const rows = useMemo<TimelineRow[]>(() => {
    if (!fair || !start) return []
    const all = timelineRows({ fair, start, tasks: roundTasks(tasks, fair.id), template: template.filter((r) => r.area === 'mwf'), members, meId: me?.id ?? null, today, nextStart: addDays(startOfWeek(fair.date), 7) })
    return all
  }, [fair, start, tasks, template, members, me?.id, today])

  // Filter: nur meine, erledigte eingeklappt; Abschnitte ohne Zeilen fallen weg
  const { visible, hiddenDone } = useMemo(() => {
    let vis = rows.filter((r) => r.kind !== 'item' || !onlyMine || r.mine)
    const hidden = vis.filter((r) => r.kind === 'item' && r.task?.status === 'erledigt').length
    if (!showDone) vis = vis.filter((r) => !(r.kind === 'item' && r.task?.status === 'erledigt'))
    vis = vis.filter((r, i) => r.kind !== 'phase' || vis[i + 1]?.kind === 'item')
    return { visible: vis, hiddenDone: hidden }
  }, [rows, onlyMine, showDone])

  // Wischen: vorherige / nächste Runde
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return
    go(dx < 0 ? 1 : -1)
  }
  function go(dir: 1 | -1) {
    setIdx((i) => Math.min(sorted.length - 1, Math.max(0, i + dir)))
    setShowDone(false)
  }

  const yearly = tasks.filter((t) => t.area === 'mwf' && t.is_yearly).sort((a, b) => (a.status === 'erledigt' ? 1 : 0) - (b.status === 'erledigt' ? 1 : 0) || a.due_date.localeCompare(b.due_date))

  return (
    <div className="mwf__screen" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Band>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span className="mwf__kicker">Checkliste</span>
            <span className="mwf__big" style={{ fontSize: 34 }}>{fair ? `Messe ${fairLabel(fair.date)}` : 'Keine Messe'}</span>
          </div>
          <button type="button" className="mwf__pill" onClick={toggleMine}>{onlyMine ? 'Alle zeigen' : 'Nur meine'}</button>
        </div>
      </Band>

      <main className="page mwf__main" style={{ gap: 4 }}>
        <div className="between" style={{ minHeight: 36 }}>
          <button type="button" className="mwf__arrow" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Vorherige Runde">‹ vorherige</button>
          <span className="hint" style={{ fontSize: 12 }}>{isCurrent ? 'laufende Runde' : isPast ? 'vergangene Runde' : start ? `Runde ab ${dueLabel(start, today).replace('bis ', '')}` : ''}</span>
          <button type="button" className="mwf__arrow" disabled={idx >= sorted.length - 1} onClick={() => go(1)} aria-label="Nächste Runde">nächste ›</button>
        </div>

        {fair && rows.length > 0 && (
          <>
            {hiddenDone > 0 && (
              <button type="button" className="mwf__donebtn" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                {showDone ? '▾ ' : '▸ '}{hiddenDone} erledigt{showDone ? ' ausblenden' : ''}
              </button>
            )}
            {!isCurrent && !isPast && <p className="hint" style={{ margin: '0 0 6px 70px', fontSize: 13 }}>Noch nicht gestartet. Vorschau aus der Vorlage.</p>}
            {isPast && rows.filter((r) => r.kind === 'item').length === 0 && <p className="hint" style={{ margin: '0 0 6px 70px', fontSize: 13 }}>Für diese Runde gab es noch keine Checkliste.</p>}
            <div className="tl2">
              {visible.map((r) => {
                const past = isPast || (isCurrent && r.date <= today)
                const line = r.kind === 'end' ? 'tl2__line tl2__line--end' : 'tl2__line' + (past ? '' : ' tl2__line--dashed')
                if (r.kind === 'phase')
                  return (
                    <div className="tl2__row" key={r.key}>
                      <span className="tl2__date tl2__date--phase">{r.dateLabel}</span>
                      <span className="tl2__col"><span className={line} /><span className="tl2__node tl2__node--phase" /></span>
                      <span className="tl2__phase">{r.title}</span>
                    </div>
                  )
                if (r.kind === 'today')
                  return (
                    <div className="tl2__row" key={r.key}>
                      <span className="tl2__date tl2__date--today">{r.dateLabel}</span>
                      <span className="tl2__col"><span className={line} /><span className="tl2__node tl2__node--today" /></span>
                      <span className="tl2__today">{r.title}</span>
                    </div>
                  )
                if (r.kind === 'fair')
                  return (
                    <div className="tl2__row" key={r.key}>
                      <span className="tl2__date tl2__date--fair">{r.dateLabel}</span>
                      <span className="tl2__col"><span className={line} /><span className="tl2__node tl2__node--fair">★</span></span>
                      <span className="tl2__fair">Messe</span>
                    </div>
                  )
                if (r.kind === 'end')
                  return (
                    <div className="tl2__row" key={r.key}>
                      <span className="tl2__date" />
                      <span className="tl2__col"><span className={line} /><span className="tl2__node tl2__node--end" /></span>
                      <span className="tl2__end">{r.title}</span>
                    </div>
                  )
                const t = r.task
                const done = t?.status === 'erledigt'
                const running = t ? t.is_running : !!r.preview?.is_running
                return (
                  <div className="tl2__row" key={r.key}>
                    <span className="tl2__date" />
                    <span className="tl2__col">
                      <span className={line} />
                      {t && !running ? (
                        <button type="button" className={'tl2__circle' + (done ? ' tl2__circle--done' : '')} onClick={() => setTaskDone(t.id, !done)} aria-pressed={done} aria-label={done ? `${t.title} wieder öffnen` : `${t.title} abhaken`}>
                          {done ? '✓' : ''}
                        </button>
                      ) : (
                        <span className={'tl2__circle' + (running ? ' tl2__circle--running' : ' tl2__circle--preview')} aria-hidden />
                      )}
                    </span>
                    <button type="button" className="tl2__text" disabled={!t} onClick={() => t && setEditing(t)}>
                      <span className={(r.mine ? 'tl2__title' : 'tl2__title--other') + (done ? ' tl2__title--done' : '')}>{t ? t.title : r.preview?.title}</span>
                      {r.meta && <span className={r.mine ? 'tl2__meta' : 'tl2__meta--other'}>{r.meta}</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {!fair && <p className="hint">Keine Messe eingetragen.</p>}

        <div className="stack" style={{ gap: 2, marginTop: 24 }}>
          <span className="todo-group__title">Jahr</span>
          {yearly.length === 0 && <span className="hint" style={{ fontSize: 13 }}>Noch kein Jahrespunkt.</span>}
          {yearly.map((t) => {
            const done = t.status === 'erledigt'
            return (
              <div className="todo" key={t.id}>
                <Check done={done} onToggle={() => setTaskDone(t.id, !done)} label={done ? 'Wieder öffnen' : 'Erledigt'} />
                <button type="button" className="task__body" onClick={() => setEditing(t)}>
                  <span className={'task__title' + (done ? ' task__title--done' : '')} style={{ lineHeight: 1.1, fontSize: 23 }}>{t.title}</span>
                  <span className="heute__sub">{t.owner_member_id ? members.find((m) => m.id === t.owner_member_id)?.display_name : 'beide'} · {dueLabel(t.due_date, today)}</span>
                </button>
              </div>
            )
          })}
          <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0', fontSize: 20 }} onClick={() => nav('/mwf/neu', { state: { kind: 'aufgabe', yearly: true } })}>+ Jahrespunkt</button>
        </div>

        <div className="spacer" />
        <Link to="/mwf/vorlage" className="link" style={{ alignSelf: 'flex-start', fontSize: 12, paddingTop: 16 }}>Vorlage bearbeiten</Link>
      </main>

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
