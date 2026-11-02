// Sonntagsrunde: nacheinander durch alle gemeinsamen Anker, ruhende zuerst
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { groupOf, logDate, phaseLabel, stepMeta, stepOf } from '../lib/anchors'
import { AnchorIcon, PhaseBars, PhasePicker, StepForm } from './AnkerTeile'

type Mode = null | 'step' | 'phase' | 'note'

export function Sonntagsrunde() {
  const { anchors, anchorLog, tasks, members, setAnchorPhase, addAnchorLog } = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()

  // Reihenfolge wird beim Start festgelegt, damit sie sich während der Runde nicht verschiebt
  const [order] = useState<string[]>(() => {
    const list = anchors.filter((a) => !a.archived_at && a.visibility === 'shared')
    const rank = (id: string) => {
      const a = anchors.find((x) => x.id === id)!
      return groupOf(a, now) === 'ruht' ? 0 : groupOf(a, now) === 'bewegung' ? 1 : 2
    }
    return list.sort((a, b) => rank(a.id) - rank(b.id) || a.moved_at.localeCompare(b.moved_at)).map((a) => a.id)
  })
  const [pos, setPos] = useState(0)
  const [mode, setMode] = useState<Mode>(null)
  const [noteText, setNoteText] = useState('')
  const [busy, setBusy] = useState(false)

  const anchor = anchors.find((a) => a.id === order[pos]) ?? null
  const step = anchor ? stepOf(anchor.id, tasks) : null
  const recent = useMemo(() => (anchor ? anchorLog.filter((l) => l.anchor_id === anchor.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3) : []), [anchorLog, anchor])

  async function next() {
    if (!anchor || busy) return
    setBusy(true)
    try {
      await addAnchorLog(anchor.id, 'sunday', 'Sonntagsrunde: besprochen')
    } finally {
      setBusy(false)
    }
    setMode(null)
    setNoteText('')
    setPos((p) => p + 1)
  }

  if (order.length === 0) {
    return (
      <div className="page" style={{ gap: 16 }}>
        <Link to="/anker" className="ank__back">‹ Alle Anker</Link>
        <h1 className="h1">Sonntagsrunde</h1>
        <p className="hint">Es gibt noch keine gemeinsamen Anker.</p>
      </div>
    )
  }

  if (!anchor) {
    return (
      <div className="page" style={{ gap: 16 }}>
        <Link to="/anker" className="ank__back">‹ Alle Anker</Link>
        <h1 className="h1">Sonntagsrunde</h1>
        <p className="hand hand--navy" style={{ fontSize: 30, lineHeight: 1.15 }}>Fertig – bis nächsten Sonntag.</p>
        <p className="hint">{order.length === 1 ? 'Ein Anker besprochen.' : `${order.length} Anker besprochen.`} Jeder hat einen Eintrag im Verlauf bekommen.</p>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start', width: 'auto', padding: '10px 22px' }} onClick={() => nav('/anker')}>Zu den Ankern</button>
      </div>
    )
  }

  return (
    <div className="page" style={{ gap: 16 }}>
      <div className="between">
        <Link to="/anker" className="ank__back">‹ Abbrechen</Link>
        <span className="ank__progress">{pos + 1} von {order.length}</span>
      </div>
      <header className="stack" style={{ gap: 6 }}>
        <span className="kicker">Sonntagsrunde</span>
        <span className="ank__row">
          <AnchorIcon size={22} />
          <span className="h1" style={{ fontSize: 38, lineHeight: 1 }}>{anchor.title}</span>
        </span>
        {anchor.why && <span className="ank__why">{anchor.why}</span>}
        {mode === 'phase' ? (
          <PhasePicker phase={anchor.phase} onChange={async (p) => { if (p !== anchor.phase) await setAnchorPhase(anchor.id, p); setMode(null) }} />
        ) : (
          <PhaseBars phase={anchor.phase} />
        )}
      </header>

      <section className="stack" style={{ gap: 8 }}>
        <span className="label">Stand</span>
        {recent.length === 0 && <span className="hint">Noch kein Verlauf.</span>}
        {recent.map((l) => (
          <div className="ank__log" key={l.id}>
            <span className="ank__logdate">{logDate(l.at, today)}</span>
            <span className="ank__logtext">{l.text}</span>
          </div>
        ))}
      </section>

      <div className="note ank__note">
        <span className="label label--small">{mode === 'step' ? (step ? 'Schritt ändern' : 'Nächster Schritt') : 'Nächster Schritt'}</span>
        {mode === 'step' ? (
          <StepForm anchorId={anchor.id} step={step} onDone={() => setMode(null)} onCancel={() => setMode(null)} cancelLabel="abbrechen" />
        ) : step ? (
          <>
            <span className="hand hand--navy" style={{ fontSize: 26, lineHeight: 1.1 }}>{step.title}</span>
            <span className="ank__small">{stepMeta(step, members, today)}</span>
          </>
        ) : (
          <span className="hand" style={{ fontSize: 24, color: 'var(--brown)' }}>{anchor.ask_next ? 'Und der nächste Schritt?' : 'Noch kein Schritt festgelegt'}</span>
        )}
      </div>

      {mode === 'note' && (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="textarea-lined" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Was haben wir besprochen?" autoFocus />
          <div className="between">
            <button type="button" className="link" onClick={() => { setMode(null); setNoteText('') }}>abbrechen</button>
            <button type="button" className="link link--hand" onClick={async () => { if (noteText.trim()) await addAnchorLog(anchor.id, 'note', noteText.trim()); setNoteText(''); setMode(null) }}>Eintragen</button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="ank__round">
          <button type="button" className="ank__sunday" disabled={busy} onClick={next}>passt so</button>
          <button type="button" className="ank__sunday" onClick={() => setMode('step')}>Schritt ändern</button>
          <button type="button" className="ank__sunday" onClick={() => setMode('phase')}>Phase ändern</button>
          <button type="button" className="ank__sunday" onClick={() => setMode('note')}>Notiz</button>
        </div>
      )}

      <div className="spacer" />
      <div className="between">
        <span className="hint">{phaseLabel(anchor.phase)}</span>
        <button type="button" className="btn" style={{ width: 'auto', padding: '10px 22px' }} disabled={busy} onClick={next}>
          {pos + 1 < order.length ? 'Weiter →' : 'Fertig'}
        </button>
      </div>
    </div>
  )
}
