import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { Chips, HandInput, MicButton, Tabs } from '../components/ui'
import { WhenPicker } from './WhenPicker'
import { RepeatPicker } from './RepeatPicker'
import type { Repeat } from '../lib/types'
import { addDays } from '../lib/dates'

type Kind = 'aufgabe' | 'termin'

export function Neu() {
  const casa = useCasa()
  const nav = useNavigate()
  const loc = useLocation()
  const today = useToday()
  const preset = (loc.state ?? {}) as { kind?: Kind; date?: string }

  const [kind, setKind] = useState<Kind>(preset.kind ?? 'aufgabe')
  const [title, setTitle] = useState('')
  const [who, setWho] = useState<string | null>(null) // member id | 'beide' | 'p:<person id>'
  const [when, setWhen] = useState<string | null>(preset.date ?? null)
  const [time, setTime] = useState('')
  const [multi, setMulti] = useState(false)
  const [until, setUntil] = useState('')
  const [repeat, setRepeat] = useState<Repeat | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const partners = casa.members.filter((m) => m.role === 'partner')
  const people =
    kind === 'termin'
      ? [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'beide', label: 'Beide' }, ...casa.people.map((p) => ({ value: 'p:' + p.id, label: p.name }))]
      : partners.map((m) => ({ value: m.id, label: m.display_name }))

  const ready = title.trim().length > 0 && !!who && !!when && (!multi || (!!until && until >= when))
  const missing = !who && !when ? 'Wer und wann fehlen noch' : !who ? 'Wer fehlt noch' : !when ? 'Wann fehlt noch' : multi && (!until || until < (when ?? '')) ? 'Bis wann fehlt noch' : 'Was fehlt noch'

  function pickKind(k: Kind) {
    setKind(k)
    if (k === 'aufgabe' && (who === 'beide' || who?.startsWith('p:'))) setWho(null)
    if (k === 'aufgabe') setMulti(false)
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
        await casa.addTask({ title: title.trim(), owner_member_id: who, due_date: when, repeat })
      } else {
        await casa.addEvent({
          title: title.trim(),
          date: when,
          end_date: multi && until > when ? until : null,
          member_id: who === 'beide' || who.startsWith('p:') ? null : who,
          person_id: who.startsWith('p:') ? who.slice(2) : null,
          start_time: multi ? null : time || null,
          repeat,
        })
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
          <span className="label">{kind === 'aufgabe' ? 'Bis wann?' : multi ? 'Von wann?' : 'Wann?'}</span>
          <WhenPicker kind={kind} value={when} onChange={setWhen} today={today} />
          {kind === 'termin' && !multi && (
            <div className="stack stack--tight" style={{ marginTop: 6 }}>
              <label className="label label--small" htmlFor="neu-time">Uhrzeit (optional)</label>
              <input id="neu-time" className="input-ui" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
            </div>
          )}
          {kind === 'termin' && (
            <div className="stack stack--tight" style={{ marginTop: 6 }}>
              {!multi ? (
                <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '2px 0' }} onClick={() => { setMulti(true); setUntil(when ? addDays(when, 1) : '') }}>
                  + mehrere Tage (z. B. Valerie bei Oma So–Di)
                </button>
              ) : (
                <>
                  <label className="label label--small" htmlFor="neu-until">Bis wann?</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input id="neu-until" className="input-ui" type="date" value={until} min={when ?? undefined} onChange={(e) => setUntil(e.target.value)} style={{ minWidth: 180 }} />
                    <button type="button" className="link" onClick={() => setMulti(false)}>nur ein Tag</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          <span className="label">Wiederholen?</span>
          <RepeatPicker value={repeat} onChange={setRepeat} />
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
