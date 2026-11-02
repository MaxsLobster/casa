import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CasaProvider, useCasa } from './state/HouseholdContext'
import { useTheme } from './state/theme'
import { Nav } from './components/Nav'
import { InkFilters } from './components/InkFilters'
import { Login } from './screens/Login'
import { Heute } from './screens/Heute'
import { Woche } from './screens/Woche'
import { ToDos } from './screens/ToDos'
import { Neu } from './screens/Neu'
import { Anker } from './screens/Anker'
import { AnkerDetail } from './screens/AnkerDetail'
import { Sonntagsrunde } from './screens/Sonntagsrunde'
import { Einstellungen } from './screens/Einstellungen'
import { SetPassword } from './screens/SetPassword'
import { clearRecovery, pendingRecovery } from './lib/auth'
import { finishSplash, wantsStagger } from './state/splash'
import { useSplashGone } from './state/splash'
import { Mila } from './mila/Mila'

export default function App() {
  return (
    <CasaProvider>
      <InkFilters />
      <Shell />
    </CasaProvider>
  )
}

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

function Shell() {
  const casa = useCasa()
  useTheme(casa.settings ? casa.settings.dark_mode_auto : null)
  const wide = useWide()
  const loc = useLocation()
  const splashGone = useSplashGone()
  const [recovery, setRecovery] = useState(pendingRecovery)

  // Zettel vom Kaltstart wegnehmen, sobald klar ist, was darunter liegt.
  const ready = casa.authReady && (!casa.user || recovery || casa.dataReady)
  const heuteReady = casa.authReady && !!casa.user && !recovery && casa.dataReady && !!casa.me
  useEffect(() => {
    if (ready) finishSplash(heuteReady && wantsStagger() ? 'stagger' : 'quick')
  }, [ready, heuteReady])
  useEffect(() => {
    // Nach spätestens drei Sekunden Zettel weg, auch wenn noch geladen wird
    const t = window.setTimeout(() => finishSplash('quick'), 3000)
    return () => window.clearTimeout(t)
  }, [])

  if (!casa.authReady) return <Blank />
  if (!casa.user) return <Login />
  if (recovery) {
    return (
      <div className="app">
        <div className="pane">
          <div className="page" style={{ gap: 24, maxWidth: 480, margin: '0 auto', paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>
            <header className="stack stack--tight">
              <h1 className="h1" style={{ fontSize: 56 }}>Casa</h1>
              <span className="kicker">Willkommen</span>
            </header>
            <SetPassword
              mode="first"
              onDone={() => {
                clearRecovery()
                setRecovery(false)
              }}
            />
          </div>
        </div>
      </div>
    )
  }
  if (!casa.dataReady) return <Blank text="Einen Moment …" />

  if (!casa.me) {
    return (
      <div className="app">
        <div className="pane">
          <div className="page" style={{ gap: 20, paddingTop: 72 }}>
            <h1 className="h1">Casa</h1>
            <p className="hand hand--navy">Diese Adresse ist für Casa nicht freigeschaltet.</p>
            <p className="hint">{casa.user.email}</p>
            {casa.error && <p className="hint hint--brown">{casa.error}</p>}
            <button type="button" className="btn btn--ghost" onClick={casa.signOut}>Abmelden</button>
          </div>
        </div>
      </div>
    )
  }

  // Mila, der Essensplaner: eigener Bereich mit eigener Leiste
  if (loc.pathname.startsWith('/mila')) return <Mila />

  const isNeu = loc.pathname === '/neu'

  return (
    <div className="app">
      <div className="panes">
        {wide && (
          <div className="pane pane--side">
            <Heute />
          </div>
        )}
        <div className="pane">
          <Routes>
            <Route path="/heute" element={wide ? <Woche /> : <Heute />} />
            <Route path="/woche" element={<Woche />} />
            <Route path="/todos" element={<ToDos />} />
            <Route path="/offen" element={<Navigate to="/todos" replace />} />
            <Route path="/anker" element={<Anker />} />
            <Route path="/anker/runde" element={<Sonntagsrunde />} />
            <Route path="/anker/:id" element={<AnkerDetail />} />
            <Route path="/sonntag" element={<Navigate to="/anker" replace />} />
            <Route path="/einstellungen" element={<Einstellungen />} />
            <Route path="/neu" element={wide ? <Woche /> : <Heute />} />
            <Route path="*" element={<Navigate to="/heute" replace />} />
          </Routes>
        </div>
      </div>
      <Nav />
      {splashGone && <div className="edge" aria-hidden="true" />}
      {isNeu && <Neu />}
      {casa.error && (
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(var(--nav-h) + 12px)', zIndex: 40 }}>
          <div className="note" style={{ transform: 'none' }}>
            <span className="hand" style={{ fontSize: 22 }}>{casa.error}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Blank({ text }: { text?: string }) {
  return (
    <div className="app">
      <div className="pane">
        <div className="page" style={{ paddingTop: 72 }}>
          <h1 className="h1" style={{ fontSize: 56 }}>Casa</h1>
          {text && <span className="hint">{text}</span>}
        </div>
      </div>
    </div>
  )
}
