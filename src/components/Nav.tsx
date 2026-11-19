// Schwebende Leiste (Milchglas-Pille): nur Zeichen. Heute · Woche · [+] · [Manager] · To-Dos · Anker
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useCasa } from '../state/HouseholdContext'

const ICON = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const HeuteIcon = () => (
  <svg {...ICON}>
    <rect x="5" y="5" width="14" height="15" rx="2" />
    <path d="M5 9.5h14M9 3v4M15 3v4" />
    <path d="M10 14.5h4" />
  </svg>
)
const WocheIcon = () => (
  <svg {...ICON}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M7.5 9v6M10.5 9v6M13.5 9v6M16.5 9v6" />
  </svg>
)
const TodoIcon = () => (
  <svg {...ICON}>
    <rect x="4" y="5" width="4.5" height="4.5" rx="1" />
    <path d="M5 7.3l1 1 1.6-1.8" />
    <rect x="4" y="13.5" width="4.5" height="4.5" rx="1" />
    <path d="M11.5 7.3h8.5M11.5 15.8h8.5" />
  </svg>
)
const AnkerIcon = () => (
  <svg {...ICON}>
    <circle cx="12" cy="5" r="1.8" />
    <path d="M12 6.8v13.4M8.5 10h7" />
    <path d="M5 14.5c0 3.2 3.2 5.7 7 5.7s7-2.5 7-5.7" />
    <path d="M4 15.5l1-1.4 1.4 1" />
    <path d="M20 15.5l-1-1.4-1.4 1" />
  </svg>
)
export const BubbleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
    <path d="M8.5 11.2h.01M12 11.2h.01M15.5 11.2h.01" strokeWidth="2.4" />
  </svg>
)

function Tab({ to, label, cls = '', children }: { to: string; label: string; cls?: string; children: ReactNode }) {
  return (
    <NavLink to={to} className={'pill__tab' + cls} aria-label={label}>
      {children}
    </NavLink>
  )
}

/** Manager-Knopf: Antippen öffnet den Manager. (Teil 3: Blatt und Gedrückthalten zum Sprechen) */
export function Nav({ manager }: { manager?: ReactNode }) {
  const nav = useNavigate()
  const hidden = useCasa().settings?.hidden_areas ?? []
  return (
    <nav className="pill" aria-label="Hauptnavigation">
      <Tab to="/heute" label="Heute" cls=" pill__tab--heute"><HeuteIcon /></Tab>
      <Tab to="/woche" label="Woche"><WocheIcon /></Tab>
      <span className="pill__mid">
        <button type="button" className="pill__plus" aria-label="Neu eintragen" onClick={() => nav('/neu')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {manager ?? (
          <button type="button" className="pill__mgr" aria-label="Casa-Manager" onClick={() => nav('/manager')}>
            <BubbleIcon />
          </button>
        )}
      </span>
      <Tab to="/todos" label="To-Dos"><TodoIcon /></Tab>
      {!hidden.includes('anker') && <Tab to="/anker" label="Anker"><AnkerIcon /></Tab>}
    </nav>
  )
}
