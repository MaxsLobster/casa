// Mila · Gerüst: Kopf, Routen, drei Reiter
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { MilaProvider, useMila } from './MilaContext'
import { PotIcon } from './icons'
import { useSplashGone } from '../state/splash'
import { Woche } from './Woche'
import { Liste } from './Liste'
import { Gerichte } from './Gerichte'
import { Gericht } from './Gericht'
import { RezeptForm } from './RezeptForm'
import { Kochen } from './Kochen'
import './mila.css'

export function Mila() {
  return (
    <MilaProvider>
      <MilaShell />
    </MilaProvider>
  )
}

function MilaShell() {
  const splashGone = useSplashGone()
  const loc = useLocation()
  // Detail, Formular und Kochmodus haben eigene Knöpfe unten, keine Reiterleiste
  const showNav = !/^\/mila\/(gerichte\/.+|kochen)/.test(loc.pathname)
  const cooking = loc.pathname.startsWith('/mila/kochen')
  return (
    <div className={'app mila' + (cooking ? ' mila--kochen' : '')}>
      <div className="panes">
        <div className="pane">
          <Routes>
            <Route path="/mila/woche" element={<Woche />} />
            <Route path="/mila/liste" element={<Liste />} />
            <Route path="/mila/gerichte" element={<Gerichte />} />
            <Route path="/mila/gerichte/neu" element={<RezeptForm />} />
            <Route path="/mila/gerichte/:id" element={<Gericht />} />
            <Route path="/mila/gerichte/:id/bearbeiten" element={<RezeptForm />} />
            <Route path="/mila/kochen/:id" element={<Kochen />} />
            <Route path="*" element={<Navigate to="/mila/woche" replace />} />
          </Routes>
        </div>
      </div>
      {showNav && (
        <nav className="nav" aria-label="Mila">
          <NavLink to="/mila/woche" className="nav__item">Woche</NavLink>
          <NavLink to="/mila/liste" className="nav__item">Liste</NavLink>
          <NavLink to="/mila/gerichte" className="nav__item">Gerichte</NavLink>
        </nav>
      )}
      {splashGone && <div className="edge" aria-hidden="true" />}
    </div>
  )
}

/** Oberste Zeile: ‹ Casa links, Mila-Marke rechts */
export function MilaTop() {
  return (
    <div className="m-top">
      <Link to="/heute" className="m-back">‹ Casa</Link>
      <span className="m-brand">
        <PotIcon size={16} />
        Mila
      </span>
    </div>
  )
}

/** Seite mit Kopf; zeigt Ladezustand und Fehler aus dem Kontext */
export function MilaPage({ children }: { children: ReactNode }) {
  const { ready, error } = useMila()
  return (
    <div className="page">
      <MilaTop />
      {error && <p className="hint hint--brown">{error}</p>}
      {ready ? children : <span className="hint">Einen Moment …</span>}
    </div>
  )
}
