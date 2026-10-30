import { useCallback, useState } from 'react'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { Event, Repeat } from '../lib/types'
import { Chips, HandInput, Sheet } from '../components/ui'
import { WhenPicker } from './WhenPicker'
import { RepeatPicker } from './RepeatPicker'

export function EventEditor({ event, onClose }: { event: Event; onClose: () => void }) {
  const { members, people, updateEvent, removeEvent } = useCasa()
  const today = useToday()
  const close = useCallback(() => onClose(), [onClose])
  const [title, setTitle] = useState(event.title)
  const [who, setWho] = useState<string>(event.person_id ? 'p:' + event.person_id : (event.member_id ?? 'beide'))
  const [date, setDate] = useState<string | null>(event.date)
  const [until, setUntil] = useState(event.end_date ?? '')
  const [time, setTime] = useState((event.start_time ?? '').slice(0, 5))
  const [endTime, setEndTime] = useState((event.end_time ?? '').slice(0, 5))
  const [repeat, setRepeat] = useState<Repeat | null>(event.repeat)
  const [note, setNote] = useState(event.note ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const options = [
    ...members.filter((m) => m.role === 'partner').map((m) => ({ value: m.id, label: m.display_name })),
    { value: 'beide', label: 'Beide' },
    ...people.map((p) => ({ value: 'p:' + p.id, label: p.name })),
  ]
  const multi = !!until && !!date && until > date
  const ready = title.trim().length > 0 && !!date && (!until || until >= date)

  async function save() {
    if (!ready || !date) return
    setBusy(true)
    try {
      await updateEvent(event.id, {
        title: title.trim(),
        date,
        end_date: multi ? until : null,
        member_id: who === 'beide' || who.startsWith('p:') ? null : who,
        person_id: who.startsWith('p:') ? who.slice(2) : null,
        start_time: multi ? null : time || null,
        end_time: multi ? null : endTime || null,
        repeat,
        note: note.trim() || null,
      })
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
        <Chips options={options} value={who} onChange={setWho} />
      </div>
      <div className="stack">
        <span className="label">{multi ? 'Von wann?' : 'Wann?'}</span>
        <WhenPicker kind="termin" value={date} onChange={setDate} today={today} />
        <div className="stack stack--tight" style={{ marginTop: 6 }}>
          <label className="label label--small" htmlFor="ev-until">Bis (leer = ein Tag)</label>
          <input id="ev-until" className="input-ui" type="date" value={until} min={date ?? undefined} onChange={(e) => setUntil(e.target.value)} style={{ alignSelf: 'flex-start', minWidth: 180 }} />
        </div>
        {!multi && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <div className="stack stack--tight">
              <label className="label label--small" htmlFor="ev-time">Von</label>
              <input id="ev-time" className="input-ui" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ minWidth: 130 }} />
            </div>
            <div className="stack stack--tight">
              <label className="label label--small" htmlFor="ev-end">Bis (optional)</label>
              <input id="ev-end" className="input-ui" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ minWidth: 130 }} />
            </div>
          </div>
        )}
      </div>
      <div className="stack">
        <span className="label">Wiederholen?</span>
        <RepeatPicker value={repeat} onChange={setRepeat} />
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
