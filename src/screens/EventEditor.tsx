import { useCallback, useState } from 'react'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { Event } from '../lib/types'
import { Chips, HandInput, Sheet } from '../components/ui'
import { WhenPicker } from './WhenPicker'

export function EventEditor({ event, onClose }: { event: Event; onClose: () => void }) {
  const { members, updateEvent, removeEvent } = useCasa()
  const today = useToday()
  const close = useCallback(() => onClose(), [onClose])
  const [title, setTitle] = useState(event.title)
  const [who, setWho] = useState<string>(event.member_id ?? 'beide')
  const [date, setDate] = useState<string | null>(event.date)
  const [time, setTime] = useState((event.start_time ?? '').slice(0, 5))
  const [note, setNote] = useState(event.note ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const people = [...members.filter((m) => m.role === 'partner').map((m) => ({ value: m.id, label: m.display_name })), { value: 'beide', label: 'Beide' }]
  const ready = title.trim().length > 0 && !!date

  async function save() {
    if (!ready || !date) return
    setBusy(true)
    try {
      await updateEvent(event.id, { title: title.trim(), date, member_id: who === 'beide' ? null : who, start_time: time || null, note: note.trim() || null })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={close} title="Termin bearbeiten">
      <div className="between">
        <span className="kicker">Termin</span>
        <button type="button" className="link" onClick={close}>Schließen</button>
      </div>
      <HandInput value={title} onChange={setTitle} placeholder="Was steht an?" />
      <div className="stack">
        <span className="label">Wer?</span>
        <Chips options={people} value={who} onChange={setWho} />
      </div>
      <div className="stack">
        <span className="label">Wann?</span>
        <WhenPicker kind="termin" value={date} onChange={setDate} today={today} />
        <div className="stack stack--tight" style={{ marginTop: 6 }}>
          <label className="label label--small" htmlFor="ev-time">Uhrzeit (optional)</label>
          <input id="ev-time" className="input-ui" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
        </div>
      </div>
      <div className="stack">
        <label className="label" htmlFor="ev-note">Notiz</label>
        <textarea id="ev-note" className="textarea-lined" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Schreib was dazu …" />
      </div>
      <button type="button" className="btn" disabled={!ready || busy} onClick={save}>Speichern</button>
      {!confirmRemove ? (
        <button type="button" className="link" onClick={() => setConfirmRemove(true)}>Termin entfernen</button>
      ) : (
        <div className="between">
          <span className="hint">Wirklich entfernen?</span>
          <button type="button" className="link" style={{ color: 'var(--brown)' }} onClick={async () => { await removeEvent(event.id); onClose() }}>Ja, entfernen</button>
          <button type="button" className="link" onClick={() => setConfirmRemove(false)}>Nein</button>
        </div>
      )}
    </Sheet>
  )
}
