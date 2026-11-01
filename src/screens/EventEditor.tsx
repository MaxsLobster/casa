import { useCallback, useState } from 'react'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { Event, Repeat } from '../lib/types'
import { Chips, HandInput, Sheet } from '../components/ui'
import { WhenPicker } from './WhenPicker'
import { RepeatPicker } from './RepeatPicker'
import { EffectChips, HandoverFields, effectChoice, parseEffect, type EffectChoice, type Handover } from './EffectPicker'
import { defaultTitle } from '../lib/effects'

export function EventEditor({ event, onClose }: { event: Event; onClose: () => void }) {
  const { me, members, people, updateEvent, removeEvent } = useCasa()
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
  const [choice, setChoice] = useState<EffectChoice>(() => effectChoice(event))
  const [handover, setHandover] = useState<Handover>({ dropoff_by: event.dropoff_by, dropoff_at: (event.dropoff_at ?? '').slice(0, 5), pickup_by: event.pickup_by, pickup_at: (event.pickup_at ?? '').slice(0, 5) })
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const partners = members.filter((m) => m.role === 'partner')
  const fx = parseEffect(choice)
  const askWho = fx.effect === 'termin' || fx.effect === 'valerie_weg'
  const options =
    fx.effect === 'valerie_weg'
      ? people.map((p) => ({ value: 'p:' + p.id, label: p.name }))
      : [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'beide', label: 'Beide' }, ...people.map((p) => ({ value: 'p:' + p.id, label: p.name }))]
  const autoTitle = defaultTitle(fx.effect, who.startsWith('p:') ? (people.find((p) => 'p:' + p.id === who)?.name ?? null) : null, fx.member_id ? (partners.find((m) => m.id === fx.member_id)?.display_name ?? null) : null)
  const finalTitle = title.trim() || autoTitle
  const multi = !!until && !!date && until > date
  const ready = finalTitle.length > 0 && !!date && (!until || until >= date)

  function pickEffect(c: EffectChoice) {
    setChoice(c)
    const e = parseEffect(c)
    if (e.effect === 'valerie_weg' && !who.startsWith('p:')) setWho('beide')
    if (e.effect === 'kita_zu' || e.effect === 'eltern_weg') setWho('beide')
  }

  async function save() {
    if (!ready || !date) return
    setBusy(true)
    try {
      const w = askWho ? who : 'beide'
      await updateEvent(event.id, {
        title: finalTitle,
        date,
        end_date: multi ? until : null,
        member_id: fx.effect === 'eltern_weg' ? fx.member_id : w === 'beide' || w.startsWith('p:') ? null : w,
        person_id: w.startsWith('p:') ? w.slice(2) : null,
        effect: fx.effect,
        dropoff_by: fx.effect === 'valerie_weg' ? handover.dropoff_by : null,
        dropoff_at: fx.effect === 'valerie_weg' && handover.dropoff_by ? handover.dropoff_at || null : null,
        pickup_by: fx.effect === 'valerie_weg' ? handover.pickup_by : null,
        pickup_at: fx.effect === 'valerie_weg' && handover.pickup_by ? handover.pickup_at || null : null,
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
      <HandInput value={title} onChange={setTitle} placeholder={autoTitle || 'Was steht an?'} />
      <EffectChips value={choice} onChange={pickEffect} partners={partners} />
      {askWho && (
        <div className="stack">
          <span className="label">{fx.effect === 'valerie_weg' ? 'Bei wem?' : 'Wer?'}</span>
          <Chips options={options} value={who} onChange={setWho} />
        </div>
      )}
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
      {fx.effect === 'valerie_weg' && <HandoverFields value={handover} onChange={setHandover} me={me} members={members} people={people} />}
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
