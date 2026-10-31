// Mila · Gerichte (Schritt 3: Gerüst; Filter, Kacheln und Detail kommen in Schritt 5)
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'

export function Gerichte() {
  const { recipes } = useMila()
  const sorted = [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return (
    <MilaPage>
      <header className="stack stack--tight">
        <span className="m-title">Unsere Gerichte</span>
        <span className="m-sub">{recipes.length} Gerichte</span>
      </header>
      <div className="m-days">
        {sorted.map((r) => (
          <div key={r.id} className="m-day">
            <div className="m-day__row" style={{ minHeight: 52 }}>
              <span className="m-day__mid">
                <span className="m-day__dish" style={{ fontSize: 23 }}>{r.name}</span>
              </span>
              <span className="m-day__right">
                {isThermomix(r.devices) && <span className="m-tm">TM</span>}
                <span className="m-day__time">{minutes(r.time_min)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </MilaPage>
  )
}
