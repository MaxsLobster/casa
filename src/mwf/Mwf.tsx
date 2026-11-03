// MWF · Gerüst: Bereich mwf, eigene Leiste (Hub · Checkliste · + · To-Dos · Anker), Navy-Einband
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AreaCtx } from '../state/area'
import { useSplashGone } from '../state/splash'
import { Hub } from './Hub'
import { Checkliste } from './Checkliste'
import { Vorlage } from './Vorlage'
import { Zurufe } from './Zurufe'
import { Band } from './Band'
import { ToDos } from '../screens/ToDos'
import { Anker } from '../screens/Anker'
import { AnkerDetail } from '../screens/AnkerDetail'
import { Sonntagsrunde } from '../screens/Sonntagsrunde'
import { Neu } from '../screens/Neu'
import './mwf.css'

export function Mwf() {
  return (
    <AreaCtx.Provider value="mwf">
      <MwfShell />
    </AreaCtx.Provider>
  )
}

function MwfShell() {
  const splashGone = useSplashGone()
  const loc = useLocation()
  const nav = useNavigate()
  const isNeu = loc.pathname === '/mwf/neu'
  // Hub und Checkliste bringen ihren eigenen Einband mit, die übrigen Seiten bekommen den schmalen
  const ownBand = /^\/mwf\/(hub|checkliste|neu)/.test(loc.pathname)
  return (
    <div className="app mwf">
      <div className="panes">
        <div className="pane">
          {!ownBand && <Band compact />}
          <Routes>
            <Route path="/mwf/hub" element={<Hub />} />
            <Route path="/mwf/neu" element={<Hub />} />
            <Route path="/mwf/checkliste" element={<Checkliste />} />
            <Route path="/mwf/vorlage" element={<Vorlage />} />
            <Route path="/mwf/zurufe" element={<Zurufe />} />
            <Route path="/mwf/todos" element={<ToDos />} />
            <Route path="/mwf/anker" element={<Anker />} />
            <Route path="/mwf/anker/runde" element={<Sonntagsrunde />} />
            <Route path="/mwf/anker/:id" element={<AnkerDetail />} />
            <Route path="*" element={<Navigate to="/mwf/hub" replace />} />
          </Routes>
        </div>
      </div>
      <nav className="nav nav--mwf" aria-label="Munich Watch Fair">
        <NavLink to="/mwf/hub" className="nav__item">Hub</NavLink>
        <NavLink to="/mwf/checkliste" className="nav__item">Checkliste</NavLink>
        <span className="nav__mid">
          <button type="button" className="nav__plus" aria-label="Neu eintragen" onClick={() => nav('/mwf/neu')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </span>
        <NavLink to="/mwf/todos" className="nav__item">To-Dos</NavLink>
        <NavLink to="/mwf/anker" className="nav__item">Anker</NavLink>
      </nav>
      {splashGone && <div className="edge edge--navy" aria-hidden="true" />}
      {isNeu && <Neu />}
    </div>
  )
}
