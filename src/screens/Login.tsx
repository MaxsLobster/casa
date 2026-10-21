import { useState, type FormEvent } from 'react'
import { useCasa } from '../state/HouseholdContext'

export function Login() {
  const { auth, isDemo } = useCasa()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await auth.sendCode(email.trim())
      if (isDemo) {
        await auth.verifyCode(email.trim(), '')
      } else {
        setSent(true)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await auth.verifyCode(email.trim(), code)
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

          {!sent ? (
            <form onSubmit={send} className="stack" style={{ gap: 16 }}>
              <label className="label" htmlFor="email">Deine E-Mail-Adresse</label>
              <input
                id="email"
                className="input-ui"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.de"
              />
              {error && <p className="hint hint--brown">{error}</p>}
              <button className="btn" type="submit" disabled={busy || !email.includes('@')}>
                {busy ? 'Einen Moment …' : isDemo ? 'Anmelden' : 'Link schicken'}
              </button>
              <p className="hint">
                {isDemo
                  ? 'Demo-Modus ohne Supabase: max@beispiel.de oder anna@beispiel.de eingeben.'
                  : 'Du bekommst eine E-Mail mit einem Link und einem Code. Kein Passwort nötig.'}
              </p>
            </form>
          ) : (
            <form onSubmit={verify} className="stack" style={{ gap: 16 }}>
              <p className="hand hand--navy">Schau in dein Postfach.</p>
              <p className="hint">
                Tipp in der E-Mail auf den Link, oder gib hier den Code ein. (Falls nichts kommt: auch im Spam-Ordner nachsehen.)
              </p>
              <label className="label" htmlFor="code">Code aus der E-Mail</label>
              <input
                id="code"
                className="input-ui"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                style={{ fontSize: 24, letterSpacing: '0.2em' }}
              />
              {error && <p className="hint hint--brown">{error}</p>}
              <button className="btn" type="submit" disabled={busy || code.trim().length < 6}>
                {busy ? 'Einen Moment …' : 'Anmelden'}
              </button>
              <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setError(null) }}>
                Andere Adresse
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
