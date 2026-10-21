import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CasaProvider, useCasa } from './state/HouseholdContext'
import { useTheme } from './state/theme'
import { Nav } from './components/Nav'
import { Login } from './screens/Login'
import { Heute } from './screens/Heute'
import { Woche } from './screens/Woche'
import { Offen } from './screens/Offen'
import { Neu } from './screens/Neu'
import { Sonntag } from './screens/Sonntag'
import { Einstellungen } from './screens/Einstellungen'

export default function App() {
  return (
    <CasaProvider>
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

  if (!casa.authReady) return <Blank />
  if (!casa.user) return <Login />
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
            <Route path="/offen" element={<Offen />} />
            <Route path="/sonntag" element={<Sonntag />} />
            <Route path="/einstellungen" element={<Einstellungen />} />
            <Route path="/neu" element={wide ? <Woche /> : <Heute />} />
            <Route path="*" element={<Navigate to="/heute" replace />} />
          </Routes>
        </div>
      </div>
      <Nav />
      {isNeu && <Neu />}
      {casa.error && (
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(var(--nav-h) + 12px)', zIndex: 40 }}>
          <div className="note" style={{ transform: 'none' }}>
            <span className="hand" style={{ fontSize: 20 }}>{casa.error}</span>
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
