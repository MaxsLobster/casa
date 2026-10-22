import { useState, type FormEvent } from 'react'
import { useCasa } from '../state/HouseholdContext'
import { takeAuthError } from '../lib/auth'

export function Login() {
  const { auth, isDemo } = useCasa()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const e = takeAuthError()
    return e ? 'Der Link ist abgelaufen oder ungültig. Melde dich mit deinem Passwort an oder bitte Max um einen neuen Link.' : null
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await auth.signIn(email.trim(), password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="pane">
        <div className="page" style={{ gap: 28, maxWidth: 480, margin: '0 auto', paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>
          <header className="stack stack--tight">
            <h1 className="h1" style={{ fontSize: 56 }}>Casa</h1>
            <span className="kicker">Notizbuch für zwei</span>
          </header>

          <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
            <label className="label" htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              className="input-ui"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
            />
            <label className="label" htmlFor="password">Passwort</label>
            <input
              id="password"
              className="input-ui"
              type="password"
              autoComplete="current-password"
              required={!isDemo}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error && <p className="hint hint--brown">{error}</p>}
            <button className="btn" type="submit" disabled={busy || !email.includes('@') || (!isDemo && password.length === 0)}>
              {busy ? 'Einen Moment …' : 'Anmelden'}
            </button>
            <p className="hint">
              {isDemo
                ? 'Demo-Modus ohne Supabase: max@beispiel.de oder anna@beispiel.de, Passwort egal.'
                : 'Nur für Max und Anna. Du bleibst danach angemeldet.'}
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
