// Ein Anker: Kopf, Fortschritt, nächster Schritt (Klebezettel), offene Fragen, Verlauf, Notizen, Aufgaben dazu
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { AnchorQuestion, Task } from '../lib/types'
import { logDate, stepMeta, stepOf } from '../lib/anchors'
import { AnchorIcon, AnchorSheet, PhasePicker, StepForm } from './AnkerTeile'
import { Check, HandInput, Sheet } from '../components/ui'
import { TaskEditor } from './TaskEditor'
import { dueLabel } from '../lib/anchors'
import { areaBase, useArea } from '../state/area'

export function AnkerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const base = areaBase(useArea())
  const today = useToday()
  const { anchors, anchorLog, anchorQuestions, tasks, members, me, pins, setPin, setAnchorPhase, updateAnchor, addAnchorLog, addQuestion, resolveQuestion, reopenQuestion, removeQuestion, setTaskDone, archiveAnchor } = useCasa()
  const anchor = anchors.find((a) => a.id === id) ?? null

  const step = anchor ? stepOf(anchor.id, tasks) : null
  const [editing, setEditing] = useState(false)
  const [stepForm, setStepForm] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [questionOpen, setQuestionOpen] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [resolving, setResolving] = useState<AnchorQuestion | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [notes, setNotes] = useState(anchor?.notes ?? '')
  const notesRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    setNotes(anchor?.notes ?? '')
  }, [anchor?.id, anchor?.notes])
  // Notizen wachsen mit dem Text
  useEffect(() => {
    const el = notesRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [notes])

  const log = useMemo(() => anchorLog.filter((l) => l.anchor_id === id).sort((a, b) => b.at.localeCompare(a.at) || b.created_at.localeCompare(a.created_at)), [anchorLog, id])
  const questions = useMemo(() => anchorQuestions.filter((q) => q.anchor_id === id), [anchorQuestions, id])
  const openQs = questions.filter((q) => !q.resolved_at).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
  const doneQs = questions.filter((q) => q.resolved_at).sort((a, b) => (b.resolved_at ?? '').localeCompare(a.resolved_at ?? ''))
  const linked = useMemo(
    () => tasks.filter((t) => t.anchor_id === id && !t.is_step).sort((a, b) => (a.status === 'erledigt' ? 1 : 0) - (b.status === 'erledigt' ? 1 : 0) || a.due_date.localeCompare(b.due_date)),
    [tasks, id],
  )
  const nameOf = (mid: string | null) => members.find((m) => m.id === mid)?.display_name ?? ''

  if (!anchor) {
    return (
      <div className="page">
        <Link to={base + '/anker'} className="ank__back">‹ Alle Anker</Link>
        <p className="hint">Diesen Anker gibt es nicht (mehr).</p>
      </div>
    )
  }

  const pinned = pins.has(anchor.id)
  // Schritt erledigt → sofort „Und der nächste Schritt?"
  const askNext = !step && anchor.ask_next

  async function saveNote() {
    const t = noteText.trim()
    if (t) await addAnchorLog(anchor!.id, 'note', t)
    setNoteText('')
    setNoteOpen(false)
  }
  async function saveQuestion() {
    const t = questionText.trim()
    if (t) await addQuestion(anchor!.id, t.endsWith('?') ? t : t + '?')
    setQuestionText('')
    setQuestionOpen(false)
  }
  async function saveNotes() {
    const t = notes.trim() || null
    if (t !== (anchor!.notes ?? null)) await updateAnchor(anchor!.id, { notes: t })
  }

  return (
    <div className="page" style={{ gap: 18 }}>
      <Link to={base + '/anker'} className="ank__back">‹ Alle Anker</Link>

      {/* ---------- Kopf ---------- */}
      <header className="stack" style={{ gap: 6 }}>
        <button type="button" className="ank__h1" onClick={() => setEditing(true)} aria-label="Anker bearbeiten">
          <AnchorIcon size={22} />
          <span className="h1" style={{ fontSize: 40, lineHeight: 1 }}>{anchor.title}</span>
        </button>
        {anchor.why ? (
          <button type="button" className="ank__body ank__why" onClick={() => setEditing(true)}>{anchor.why}</button>
        ) : (
          <button type="button" className="ank__body ank__why" style={{ color: 'var(--grey-2)' }} onClick={() => setEditing(true)}>Warum ist das wichtig?</button>
        )}
        <div className="chips" style={{ marginTop: 4 }}>
          <button type="button" className="chip" onClick={() => setEditing(true)}>{anchor.visibility === 'private' ? 'nur ich' : 'gemeinsam'}</button>
          <button type="button" className={'chip' + (pinned ? ' chip--on' : '')} role="switch" aria-checked={pinned} onClick={() => setPin(anchor.id, !pinned)}>
            {pinned ? '⚓︎ Auf Startseite' : 'Auf Startseite zeigen'}
          </button>
        </div>
        {anchor.archived_at && (
          <div className="between">
            <span className="hint hint--brown">Im Archiv.</span>
            <button type="button" className="link" onClick={() => archiveAnchor(anchor.id, false)}>zurückholen</button>
          </div>
        )}
      </header>

      {/* ---------- Fortschritt ---------- */}
      <section className="stack" style={{ gap: 4 }}>
        <span className="label">Fortschritt</span>
        <PhasePicker phase={anchor.phase} onChange={(p) => p !== anchor.phase && setAnchorPhase(anchor.id, p)} />
      </section>

      {/* ---------- Nächster Schritt ---------- */}
      <div className="note ank__note">
        <span className="label label--small">{askNext || stepForm ? (step ? 'Schritt ändern' : 'Und der nächste Schritt?') : 'Nächster Schritt'}</span>
        {stepForm || askNext ? (
          <StepForm anchorId={anchor.id} step={stepForm ? step : null} onDone={() => setStepForm(false)} onCancel={async () => { setStepForm(false); if (askNext) await updateAnchor(anchor.id, { ask_next: false }) }} />
        ) : step ? (
          <>
            <button type="button" className="ank__body" onClick={() => setStepForm(true)}>
              <span className="hand hand--navy" style={{ fontSize: 26, lineHeight: 1.1 }}>{step.title}</span>
            </button>
            <div className="between" style={{ marginTop: 4 }}>
              <span className="ank__small">{stepMeta(step, members, today)}</span>
              <button type="button" className="ank__notebtn" onClick={() => setTaskDone(step.id, true)}>erledigt</button>
            </div>
          </>
        ) : (
          <button type="button" className="ank__body" onClick={() => setStepForm(true)}>
            <span className="hand" style={{ fontSize: 24, color: 'var(--brown)' }}>Nächsten Schritt festlegen</span>
          </button>
        )}
      </div>

      {/* ---------- Offene Fragen ---------- */}
      <section className="stack" style={{ gap: 2 }}>
        <span className="label">Offene Fragen</span>
        {openQs.map((q) => (
          <button type="button" key={q.id} className="ank__q" onClick={() => setResolving(q)}>? {q.text.replace(/\?$/, '')}</button>
        ))}
        {doneQs.map((q) => (
          <button type="button" key={q.id} className="ank__q ank__q--done" onClick={() => reopenQuestion(q.id)} aria-label={`${q.text} wieder öffnen`}>{q.text}</button>
        ))}
        {questionOpen ? (
          <div className="stack" style={{ gap: 8, marginTop: 4 }}>
            <HandInput value={questionText} onChange={setQuestionText} placeholder="Was ist noch unklar?" autoFocus />
            <div className="between">
              <button type="button" className="link" onClick={() => { setQuestionOpen(false); setQuestionText('') }}>abbrechen</button>
              <button type="button" className="link link--hand" onClick={saveQuestion}>Eintragen</button>
            </div>
          </div>
        ) : (
          <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0', fontSize: 20 }} onClick={() => setQuestionOpen(true)}>+ Frage</button>
        )}
      </section>

      {/* ---------- Verlauf ---------- */}
      <section className="stack" style={{ gap: 8 }}>
        <span className="label">Verlauf</span>
        {log.length === 0 && <span className="hint">Noch nichts passiert.</span>}
        {log.map((l) => (
          <div className="ank__log" key={l.id}>
            <span className="ank__logdate">{logDate(l.at, today)}</span>
            <span className="ank__logtext">
              {l.text}
              {l.author_member_id && l.author_member_id !== me?.id && <span className="ank__logwho">{nameOf(l.author_member_id)}</span>}
            </span>
          </div>
        ))}
        {noteOpen ? (
          <div className="stack" style={{ gap: 8 }}>
            <textarea className="textarea-lined" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Was ist passiert, was ist neu?" autoFocus />
            <div className="between">
              <button type="button" className="link" onClick={() => { setNoteOpen(false); setNoteText('') }}>abbrechen</button>
              <button type="button" className="link link--hand" onClick={saveNote}>Eintragen</button>
            </div>
          </div>
        ) : (
          <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0', fontSize: 20 }} onClick={() => setNoteOpen(true)}>+ Notiz</button>
        )}
      </section>

      {/* ---------- Notizen ---------- */}
      <section className="stack" style={{ gap: 4 }}>
        <label className="label" htmlFor="ank-notes">Notizen</label>
        <textarea id="ank-notes" ref={notesRef} className="ank__notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Gedanken, Rahmen, was wichtig ist …" />
      </section>

      {/* ---------- Aufgaben dazu ---------- */}
      <section className="stack" style={{ gap: 2 }}>
        <span className="label">Aufgaben dazu</span>
        {linked.length === 0 && <span className="hint" style={{ fontStyle: 'italic' }}>Noch keine. Beim Eintragen einer Aufgabe kann man „Anker: {anchor.title}“ wählen.</span>}
        {linked.map((t) => {
          const done = t.status === 'erledigt'
          return (
            <div className="todo" key={t.id}>
              <Check done={done} onToggle={() => setTaskDone(t.id, !done)} label={done ? 'Wieder öffnen' : 'Erledigt'} />
              <button type="button" className="task__body" onClick={() => setEditTask(t)}>
                <span className={'task__title' + (done ? ' task__title--done' : '')} style={{ lineHeight: 1.1, fontSize: 23 }}>{t.title}</span>
                <span className="heute__sub">{t.owner_member_id ? nameOf(t.owner_member_id) : 'offen'} · {dueLabel(t.due_date, today)}</span>
              </button>
            </div>
          )
        })}
        <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '4px 0', fontSize: 20 }} onClick={() => nav(base + '/neu', { state: { kind: 'aufgabe', anchor: anchor.id } })}>+ Aufgabe</button>
      </section>

      <div className="spacer" />

      {editing && <AnchorSheet anchor={anchor} onClose={() => setEditing(false)} />}
      {editTask && <TaskEditor task={editTask} onClose={() => setEditTask(null)} />}
      {resolving && (
        <ResolveSheet
          question={resolving}
          onClose={() => setResolving(null)}
          onResolve={async (answer) => {
            await resolveQuestion(resolving.id, answer)
            setResolving(null)
          }}
          onRemove={async () => {
            await removeQuestion(resolving.id)
            setResolving(null)
          }}
        />
      )}
    </div>
  )
}

/** Frage geklärt: Antwort als Verlaufseintrag, oder ohne */
function ResolveSheet({ question, onClose, onResolve, onRemove }: { question: AnchorQuestion; onClose: () => void; onResolve: (answer: string | null) => void; onRemove: () => void }) {
  const [answer, setAnswer] = useState('')
  return (
    <Sheet onClose={onClose} title="Frage geklärt">
      <div className="between">
        <span className="kicker">Geklärt?</span>
        <button type="button" className="link" onClick={onClose}>Schließen</button>
      </div>
      <span className="hand hand--navy" style={{ fontSize: 24, lineHeight: 1.15 }}>{question.text}</span>
      <div className="stack">
        <label className="label" htmlFor="ank-answer">Antwort dazu (kommt in den Verlauf)</label>
        <textarea id="ank-answer" className="textarea-lined" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="optional …" autoFocus />
      </div>
      <button type="button" className="btn" onClick={() => onResolve(answer.trim() || null)}>{answer.trim() ? 'Geklärt, mit Antwort' : 'Geklärt, ohne Antwort'}</button>
      <button type="button" className="link" onClick={onRemove}>Frage entfernen</button>
    </Sheet>
  )
}
