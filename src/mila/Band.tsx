// Mila · olivgrüner Kopf mit Leinen-Korn und gezackter Kante (Wochenwahl, Kombo, Heute dran)
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function MilaBand({ kicker, title, chip, right }: { kicker: string; title: string; chip?: string | null; right?: ReactNode }) {
  return (
    <>
      <div className="mb">
        <div className="mb__top">
          <Link to="/heute" className="mb__back">‹ Casa</Link>
          {chip && <span className="mb__chip">{chip}</span>}
        </div>
        <div className="mb__row">
          <div className="mb__titles">
            <span className="mb__kicker">{kicker}</span>
            <span className="mb__title">{title}</span>
          </div>
          {right}
        </div>
      </div>
      <div className="mb__edge" aria-hidden />
    </>
  )
}

/** Avatar-Kreis M / A */
export function Initial({ name, partner, size = 20 }: { name: string; partner?: boolean; size?: number }) {
  return (
    <span className={'mb__init' + (partner ? ' mb__init--b' : '')} style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
