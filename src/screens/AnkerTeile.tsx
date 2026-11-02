// Bausteine für die Anker-Seiten: Phasen-Balken, Schritt-Eingabe, Anker-Fenster (neu/bearbeiten)
import { useCallback, useState } from 'react'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { Anchor, AnchorPhase, AnchorVisibility, Task } from '../lib/types'
import { PHASES, phaseIndex, phaseLabel } from '../lib/anchors'
import { Chips, HandInput, Sheet } from '../components/ui'
import { WhenPicker } from './WhenPicker'
import { addDays, nextWeekdayOnOrAfter } from '../lib/dates'

export function AnchorIcon({ size = 16 }: { size?: number }) {
  return <span className="ank__icon" style={{ fontSize: size, lineHeight: 1 }} aria-hidden>⚓︎</span>
}

/** Fünf kleine Balken (Übersicht) */
export function PhaseBars({ phase }: { phase: AnchorPhase }) {
  const cur = phaseIndex(phase)
  return (
    <span className="ank__bars" role="img" aria-label={`Phase ${phaseLabel(phase)}`}>
      {PHASES.map((p, i) => (
        <span key={p.value} className={'ank__bar' + (i < cur ? ' ank__bar--on' : i === cur ? ' ank__bar--cur' : '')} />
      ))}
      <span className="ank__phasename">{phaseLabel(phase)}</span>
    </span>
  )
}

/** Fünf Balken mit Namen, antippen setzt die Phase */
export function PhasePicker({ phase, onChange }: { phase: AnchorPhase; onChange: (p: AnchorPhase) => void }) {
  const cur = phaseIndex(phase)
  return (
    <div className="ank__phases" role="radiogroup" aria-label="Phase">
      {PHASES.map((p, i) => (
        <button key={p.value} type="button" role="radio" aria-checked={i === cur} className={'ank__phase' + (i === cur ? ' ank__phase--cur' : '')} onClick={() => onChange(p.value)}>
          <span className={'ank__bar' + (i < cur ? ' ank__bar--on' : i === cur ? ' ank__bar--cur' : '')} />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Nächsten Schritt festlegen oder ändern: Text, wer, bis wann */
export function StepForm({ anchorId, step, onDone, onCancel, cancelLabel = 'später' }: { anchorId: string; step: Task | null; onDone: () => void; onCancel: () => void; cancelLabel?: string }) {
  const { members, me, setStep } = useCasa()
  const today = useToday()
  const [title, setTitle] = useState(step?.title ?? '')
  const [who, setWho] = useState<string>(step ? (step.owner_member_id ?? 'beide') : (me?.id ?? 'beide'))
  // Standard: Freitag, oder nächster Freitag, wenn heute schon Freitag ist
  const freitag = nextWeekdayOnOrAfter(5, today) === today ? addDays(today, 7) : nextWeekdayOnOrAfter(5, today)
  const [due, setDue] = useState<string | null>(step?.due_date ?? freitag)
  const [busy, setBusy] = useState(false)
  const partners = members.filter((m) => m.role === 'partner')
  const ready = title.trim().length > 0 && !!due

  async function save() {
    if (!ready || !due) return
    setBusy(true)
    try {
      await setStep(anchorId, { title: title.trim(), owner_member_id: who === 'beide' ? null : who, due_date: due })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <HandInput value={title} onChange={setTitle} placeholder="Was ist der nächste konkrete Schritt?" autoFocus />
      <div className="stack">
        <span className="label">Wer?</span>
        <Chips options={[...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'beide', label: 'Beide' }]} value={who} onChange={setWho} />
        {who === 'beide' && <span className="hint">Erscheint als offene Aufgabe – wer übernimmt?</span>}
      </div>
      <div className="stack">
        <span className="label">Bis wann?</span>
        <WhenPicker kind="aufgabe" value={due} onChange={setDue} today={today} />
      </div>
      <div className="between">
        <button type="button" className="link" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="btn" style={{ width: 'auto', padding: '10px 22px' }} disabled={!ready || busy} onClick={save}>
          {step ? 'Ändern' : 'Festlegen'}
        </button>
      </div>
    </div>
  )
}

/** Fenster: neuer Anker oder Titel/Warum/Sichtbarkeit bearbeiten (und archivieren) */
export function AnchorSheet({ anchor, onClose, onCreated }: { anchor: Anchor | null; onClose: () => void; onCreated?: (a: Anchor) => void }) {
  const { addAnchor, updateAnchor, archiveAnchor } = useCasa()
  const [title, setTitle] = useState(anchor?.title ?? '')
  const [why, setWhy] = useState(anchor?.why ?? '')
  const [visibility, setVisibility] = useState<AnchorVisibility>(anchor?.visibility ?? 'shared')
  const [busy, setBusy] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const close = useCallback(() => onClose(), [onClose])
  const ready = title.trim().length > 0

  async function save() {
    if (!ready) return
    setBusy(true)
    try {
      if (anchor) {
        await updateAnchor(anchor.id, { title: title.trim(), why: why.trim() || null, visibility })
        onClose()
      } else {
        const a = await addAnchor({ title: title.trim(), why: why.trim() || null, visibility })
        onClose()
        onCreated?.(a)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={close} title={anchor ? 'Anker bearbeiten' : 'Neuer Anker'}>
      <div className="between">
        <span className="kicker">{anchor ? 'Anker bearbeiten' : 'Neuer Anker'}</span>
        <button type="button" className="link" onClick={close}>Schließen</button>
      </div>
      <HandInput value={title} onChange={setTitle} placeholder="Worum geht es?" autoFocus={!anchor} />
      <div className="stack">
        <label className="label" htmlFor="ank-why">Warum ist das wichtig?</label>
        <textarea id="ank-why" className="textarea-lined" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Ein Satz …" />
      </div>
      <div className="stack">
        <span className="label">Für wen?</span>
        <Chips options={[{ value: 'shared' as AnchorVisibility, label: 'gemeinsam' }, { value: 'private' as AnchorVisibility, label: 'nur ich' }]} value={visibility} onChange={setVisibility} />
        {visibility === 'private' && <span className="hint">Nur du siehst diesen Anker.</span>}
      </div>
      <button type="button" className="btn" disabled={!ready || busy} onClick={save}>
        {ready ? (anchor ? 'Speichern' : 'Anlegen') : 'Titel fehlt noch'}
      </button>
      {anchor && (!confirmArchive ? (
        <button type="button" className="link" onClick={() => setConfirmArchive(true)}>Anker archivieren</button>
      ) : (
        <div className="between">
          <span className="hint">Wirklich ins Archiv? Der offene Schritt geht mit.</span>
          <button type="button" className="link" style={{ color: 'var(--brown)' }} onClick={async () => { await archiveAnchor(anchor.id, true); onClose() }}>Ja</button>
          <button type="button" className="link" onClick={() => setConfirmArchive(false)}>Nein</button>
        </div>
      ))}
    </Sheet>
  )
}
