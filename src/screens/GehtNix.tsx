// „Heute geht nix“: eigene offene To-Dos von heute wandern auf morgen. Termine, Normalwoche und Sachen
// der anderen Person bleiben. Läuft ohne KI. Rückgängig über das Protokoll (manager_log).
import { useState } from 'react'
import { Sheet } from '../components/ui'
import { useCasa, useToday } from '../state/HouseholdContext'
import { addDays } from '../lib/dates'
import type { Task } from '../lib/types'

export function GehtNix({ moved, kept, partner, onClose, onDone }: { moved: Task[]; kept: string[]; partner: string | null; onClose: () => void; onDone: (n: number, undo: () => Promise<void>) => void }) {
  const { postponeTasks } = useCasa()
  const today = useToday()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function ok() {
    if (!moved.length) return onClose()
    setBusy(true)
    setErr(null)
    try {
      const undo = await postponeTasks(moved.map((t) => t.id), addDays(today, 1))
      onDone(moved.length, undo)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} title="Heute geht nix">
      <span className="nix__title">Heute geht nix? Okay.</span>
      <p className="nix__lead">
        {moved.length ? 'Ich schiebe alles, was warten kann, auf morgen. Übrig bleibt nur, was heute wirklich sein muss.' : 'Von dir steht heute nichts an, was warten kann. Mach trotzdem Feierabend.'}
      </p>
      {moved.length > 0 && (
        <section className="stack" style={{ gap: 6 }}>
          <span className="nix__label">Auf morgen</span>
          <ul className="nix__list">
            {moved.map((t) => (
              <li key={t.id}><span aria-hidden>→</span><span>{t.title}</span></li>
            ))}
          </ul>
        </section>
      )}
      {kept.length > 0 && (
        <section className="stack" style={{ gap: 6 }}>
          <span className="nix__label">Bleibt heute</span>
          <ul className="nix__list">
            {kept.map((k, i) => (
              <li key={i}><span aria-hidden>•</span><span>{k}</span></li>
            ))}
          </ul>
        </section>
      )}
      {moved.length > 0 && <span className="hint">{partner ? `${partner} bekommt keine Mitteilung – es betrifft nur deine Sachen.` : 'Es betrifft nur deine Sachen.'}</span>}
      {err && <span className="hint hint--brown">{err}</span>}
      <div className="nix__actions">
        <button type="button" className="nix__ok" disabled={busy} onClick={() => void ok()}>Okay, Feierabend</button>
        <button type="button" className="nix__no" onClick={onClose}>Doch nicht</button>
      </div>
    </Sheet>
  )
}
