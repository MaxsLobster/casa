import { NavLink, useNavigate } from 'react-router-dom'

const items = [
  { to: '/heute', label: 'Heute', cls: ' nav__item--heute' },
  { to: '/woche', label: 'Woche', cls: '' },
] as const

const items2 = [
  { to: '/offen', label: 'Offen' },
  { to: '/sonntag', label: 'Sonntag' },
] as const

export function Nav() {
  const nav = useNavigate()
  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} className={'nav__item' + i.cls}>
          {i.label}
        </NavLink>
      ))}
      <button type="button" className="nav__plus" aria-label="Neu eintragen" onClick={() => nav('/neu')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {items2.map((i) => (
        <NavLink key={i.to} to={i.to} className="nav__item">
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}
