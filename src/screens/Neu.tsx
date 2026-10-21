import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { Chips, HandInput, MicButton, Tabs } from '../components/ui'
import { WhenPicker } from './WhenPicker'

type Kind = 'aufgabe' | 'termin'

export function Neu() {
  const casa = useCasa()
  const nav = useNavigate()
  const loc = useLocation()
  const today = useToday()
  const preset = (loc.state ?? {}) as { kind?: Kind; date?: string }

  const [kind, setKind] = useState<Kind>(preset.kind ?? 'aufgabe')
  const [title, setTitle] = useState('')
  const [who, setWho] = useState<string | null>(null) // member id oder 'beide'
  const [when, setWhen] = useState<string | null>(preset.date ?? null)
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const partners = casa.members.filter((m) => m.role === 'partner')
  const people = [...partners.map((m) => ({ value: m.id, label: m.display_name })), ...(kind === 'termin' ? [{ value: 'beide', label: 'Beide' }] : [])]

  const ready = title.trim().length > 0 && !!who && !!when
  const missing = !who && !when ? 'Wer und wann fehlen noch' : !who ? 'Wer fehlt noch' : !when ? 'Wann fehlt noch' : 'Was fehlt noch'

  function pickKind(k: Kind) {
    setKind(k)
    if (k === 'aufgabe' && who === 'beide') setWho(null)
  }

  function back() {
    if (window.history.length > 1) nav(-1)
    else nav('/heute')
  }

  async function save() {
    if (!ready || !when || !who) return
    setBusy(true)
    setError(null)
    try {
      if (kind === 'aufgabe') {
        await casa.addTask({ title: title.trim(), owner_member_id: who, due_date: when })
      } else {
        await casa.addEvent({ title: title.trim(), date: when, member_id: who === 'beide' ? null : who, start_time: time || null })
      }
      back()
    } catch (err) {
      setError('Konnte nicht speichern: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay">
      <div className="page">
        <div className="between">
          <h1 className="h1">Neu notieren</h1>
          <button type="button" className="link" onClick={back}>Abbrechen</button>
        </div>

        <Tabs
          tabs={[
            { value: 'aufgabe' as Kind, label: 'Aufgabe' },
            { value: 'termin' as Kind, label: 'Termin' },
          ]}
          value={kind}
          onChange={pickKind}
        />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HandInput value={title} onChange={setTitle} placeholder={kind === 'aufgabe' ? 'Was ist zu tun?' : 'Was steht an?'} inputRef={inputRef} autoFocus />
          </div>
          <MicButton target={inputRef} />
        </div>

        <div className="stack">
          <span className="label">{kind === 'aufgabe' ? 'Wer kümmert sich?' : 'Wer?'}</span>
          <Chips options={people} value={who} onChange={setWho} />
        </div>

        <div className="stack">
          <span className="label">{kind === 'aufgabe' ? 'Bis wann?' : 'Wann?'}</span>
          <WhenPicker kind={kind} value={when} onChange={setWhen} today={today} />
          {kind === 'termin' && (
            <div className="stack stack--tight" style={{ marginTop: 6 }}>
              <label className="label label--small" htmlFor="neu-time">Uhrzeit (optional)</label>
              <input id="neu-time" className="input-ui" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
            </div>
          )}
        </div>

        {error && <p className="hint hint--brown">{error}</p>}

        <div className="spacer" />

        <button type="button" className="btn" disabled={!ready || busy} onClick={save}>
          {busy ? 'Einen Moment …' : ready ? 'Notieren' : missing}
        </button>
      </div>
    </div>
  )
}
