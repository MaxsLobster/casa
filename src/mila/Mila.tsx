// Mila · Gerüst: Kopf, Routen, drei Reiter
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { MilaProvider, useMila } from './MilaContext'
import { PotIcon } from './icons'
import { useSplashGone } from '../state/splash'
import { Woche } from './Woche'
import { Liste } from './Liste'
import { Gerichte } from './Gerichte'
import { Rezeptkarte } from './Rezeptkarte'
import { RezeptForm } from './RezeptForm'
import { Kochen } from './Kochen'
import { LaufendeKombo, Wahl } from './Wochenwahl'
import { HeuteDran } from './HeuteDran'
import { Start } from './Start'
import { Haltbarkeit } from './Haltbarkeit'
import { Prep } from './Prep'
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
  // Der ruhige Einstieg hat keine Reiterleiste, nur seine zwei Knöpfe und „Mehr“
  const showNav = !/^\/mila\/(gerichte\/.+|kochen|rezept|start)/.test(loc.pathname)
  const cooking = loc.pathname.startsWith('/mila/kochen')
  return (
    <div className={'app mila' + (cooking ? ' mila--kochen' : '')}>
      <div className="panes">
        <div className="pane">
          <Routes>
            <Route path="/mila/start" element={<Start />} />
            <Route path="/mila/heute" element={<HeuteDran />} />
            <Route path="/mila/wahl" element={<Wahl />} />
            <Route path="/mila/kombo" element={<LaufendeKombo />} />
            <Route path="/mila/haltbarkeit" element={<Haltbarkeit />} />
            <Route path="/mila/woche" element={<Woche />} />
            <Route path="/mila/karte" element={<Navigate to="/mila/wahl" replace />} />
            <Route path="/mila/einkauf" element={<Liste />} />
            <Route path="/mila/liste" element={<Navigate to="/mila/einkauf" replace />} />
            <Route path="/mila/prep" element={<Prep />} />
            <Route path="/mila/gerichte" element={<Gerichte />} />
            <Route path="/mila/gerichte/neu" element={<RezeptForm />} />
            <Route path="/mila/gerichte/:id" element={<GerichtZuKarte />} />
            <Route path="/mila/rezept/:id" element={<Rezeptkarte />} />
            <Route path="/mila/gerichte/:id/bearbeiten" element={<RezeptForm />} />
            <Route path="/mila/kochen/:id" element={<Kochen />} />
            <Route path="*" element={<Navigate to="/mila/start" replace />} />
          </Routes>
        </div>
      </div>
      {showNav && <MilaNav />}
      {splashGone && <div className="edge" aria-hidden="true" />}
    </div>
  )
}

function MilaNav() {
  const { wahl, me } = useMila()
  const p = wahl.nextPlan
  // Punkt an „Wahl“: Wahl offen und mein Stapel ist noch nicht durch (oder noch nicht gemischt)
  const mine = p ? wahl.mySwipes.filter((s) => s.plan_id === p.id).length : 0
  const dot = !!p && p.status === 'wischen' && (!p.deck_built_at || mine < p.deck.length)
  void me
  return (
    <nav className="nav" aria-label="Mila">
      <NavLink to="/mila/heute" className="nav__item">Heute</NavLink>
      <NavLink to="/mila/wahl" className="nav__item">
        Wahl{dot && <span className="m-navdot" aria-label="neu" />}
      </NavLink>
      <NavLink to="/mila/einkauf" className="nav__item">Einkauf</NavLink>
      <NavLink to="/mila/prep" className="nav__item">Prep</NavLink>
    </nav>
  )
}

/** Oberste Zeile: ‹ Casa links, Mila-Marke rechts */
export function MilaTop() {
  return (
    <div className="m-top">
      <Link to="/heute" className="m-back">‹ Casa</Link>
      <Link to="/mila/start" className="m-brand" style={{ textDecoration: 'none' }} aria-label="Mila Start">
        <PotIcon size={16} />
        Mila
      </Link>
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

/** Alte Adresse der Detailseite: führt jetzt auf die Rezeptkarte */
function GerichtZuKarte() {
  const { id } = useParams()
  return <Navigate to={`/mila/rezept/${id}`} replace state={{ from: 'fundus' }} />
}
