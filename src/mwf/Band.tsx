// Der Navy-Einband oben im MWF-Bereich: ‹ Casa, Schalter „Arbeitstag", darunter Inhalt, unten gestanzte Kante
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { isWorkday, MWF_NAME } from '../lib/mwf'

export function Band({ children, compact }: { children?: ReactNode; compact?: boolean }) {
  const { settings, setWorkday } = useCasa()
  const today = useToday()
  const on = isWorkday(settings, today)
  return (
    <>
      <div className={'mwf__band' + (compact ? ' mwf__band--compact' : '')}>
        <div className="between">
          <Link to="/heute" className="mwf__back">‹ Casa</Link>
          <button type="button" className={'mwf__workday' + (on ? ' mwf__workday--on' : '')} role="switch" aria-checked={on} onClick={() => setWorkday(!on)}>
            {on ? 'Arbeitstag' : 'Arbeitstag aus'}
          </button>
        </div>
        {compact ? <span className="mwf__kicker" style={{ marginTop: 6 }}>{MWF_NAME}</span> : children}
      </div>
      <div className="mwf__edge" aria-hidden />
    </>
  )
}
