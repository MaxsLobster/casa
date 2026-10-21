import { useCallback, useState } from 'react'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { Task, TaskStatus } from '../lib/types'
import { Chips, HandInput, Sheet } from '../components/ui'
import { WhenPicker } from './WhenPicker'

const STATUS: { value: TaskStatus; label: string }[] = [
  { value: 'offen', label: 'offen' },
  { value: 'zugesagt', label: 'zugesagt' },
  { value: 'geparkt', label: 'geparkt' },
  { value: 'erledigt', label: 'erledigt' },
]

export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { members, updateTask, removeTask } = useCasa()
  const today = useToday()
  const [title, setTitle] = useState(task.title)
  const [owner, setOwner] = useState(task.owner_member_id)
  const [due, setDue] = useState<string | null>(task.due_date)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [note, setNote] = useState(task.note ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const close = useCallback(() => onClose(), [onClose])

  const partners = members.filter((m) => m.role === 'partner')
  const ready = title.trim().length > 0 && !!owner && !!due

  async function save() {
    if (!ready || !due) return
    setBusy(true)
    try {
      await updateTask(task.id, { title: title.trim(), owner_member_id: owner, due_date: due, status, note: note.trim() || null })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={close} title="Aufgabe bearbeiten">
      <div className="between">
        <span className="kicker">Aufgabe</span>
        <button type="button" className="link" onClick={close}>Schließen</button>
      </div>

      <HandInput value={title} onChange={setTitle} placeholder="Was ist zu tun?" />

      <div className="stack">
        <span className="label">Wer kümmert sich?</span>
        <Chips options={partners.map((m) => ({ value: m.id, label: m.display_name }))} value={owner} onChange={setOwner} />
      </div>

      <div className="stack">
        <span className="label">Bis wann?</span>
        <WhenPicker kind="aufgabe" value={due} onChange={setDue} today={today} />
      </div>

      <div className="stack">
        <span className="label">Stand</span>
        <Chips options={STATUS} value={status} onChange={setStatus} variant="date" />
      </div>

      <div className="stack">
        <label className="label" htmlFor="task-note">Notiz</label>
        <textarea id="task-note" className="textarea-lined" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Schreib was dazu …" />
      </div>

      <button type="button" className="btn" disabled={!ready || busy} onClick={save}>
        {ready ? 'Speichern' : 'Wer und wann fehlen noch'}
      </button>

      {!confirmRemove ? (
        <button type="button" className="link" onClick={() => setConfirmRemove(true)}>Eintrag entfernen</button>
      ) : (
        <div className="between">
          <span className="hint">Wirklich entfernen?</span>
          <button type="button" className="link" style={{ color: 'var(--brown)' }} onClick={async () => { await removeTask(task.id); onClose() }}>Ja, entfernen</button>
          <button type="button" className="link" onClick={() => setConfirmRemove(false)}>Nein</button>
        </div>
      )}
    </Sheet>
  )
}
