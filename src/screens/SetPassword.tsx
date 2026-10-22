import { useState, type FormEvent } from 'react'
import { useCasa } from '../state/HouseholdContext'

/** Passwort festlegen (nach Einmal-Link) oder ändern (Einstellungen) */
export function SetPassword({ onDone, mode }: { onDone: () => void; mode: 'first' | 'change' }) {
  const { auth, user } = useCasa()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = pw.length >= 8 && pw === pw2

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await auth.setPassword(pw)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      {mode === 'first' && (
        <>
          <p className="hand hand--navy">Leg dein Passwort fest.</p>
          <p className="hint">Für {user?.email}. Damit meldest du dich künftig an, auf allen Geräten.</p>
        </>
      )}
      <label className="label" htmlFor="pw1">{mode === 'first' ? 'Passwort' : 'Neues Passwort'}</label>
      <input id="pw1" className="input-ui" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="mindestens 8 Zeichen" />
      <label className="label" htmlFor="pw2">Nochmal</label>
      <input id="pw2" className="input-ui" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="gleiches Passwort" />
      {pw2.length > 0 && pw !== pw2 && <p className="hint hint--brown">Die beiden Passwörter sind nicht gleich.</p>}
      {error && <p className="hint hint--brown">{error}</p>}
      <button className="btn" type="submit" disabled={!ready || busy}>
        {busy ? 'Einen Moment …' : mode === 'first' ? 'Passwort speichern' : 'Passwort ändern'}
      </button>
    </form>
  )
}
