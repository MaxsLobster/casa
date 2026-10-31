// Mila · Gerichte (Fundus): Filter, Kachelraster, Neues Rezept
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'
import { tileKind } from './portions'
import { PlusIcon, TileIcon } from './icons'
import type { MilaRecipe } from '../lib/types'

type Filter = 'alle' | 'schnell' | 'tm' | 'prep' | 'grill'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'schnell', label: 'Schnell' },
  { id: 'tm', label: 'Thermomix' },
  { id: 'prep', label: 'Meal-Prep' },
  { id: 'grill', label: 'Grill' },
]

function matches(r: MilaRecipe, f: Filter) {
  if (f === 'alle') return true
  if (f === 'tm') return isThermomix(r.devices)
  if (f === 'prep') return r.category === 'mealprep'
  if (f === 'grill') return r.category === 'grill' || r.devices.includes('bge')
  return r.category === 'schnell'
}

export function Gerichte() {
  const { recipes } = useMila()
  const [filter, setFilter] = useState<Filter>('alle')
  const list = recipes.filter((r) => matches(r, filter)).sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <MilaPage>
      <header className="stack stack--tight">
        <span className="m-title" style={{ fontSize: 40, lineHeight: 0.95 }}>Unsere Gerichte</span>
        <span className="m-hint" style={{ fontSize: 12 }}>{filter === 'alle' ? `${recipes.length} Gerichte` : `${list.length} von ${recipes.length}`}</span>
      </header>

      <div className="m-chips" role="radiogroup" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={'m-chip' + (filter === f.id ? ' m-chip--on' : '')} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <Link to="/mila/gerichte/neu" className="m-new">
        <PlusIcon />
        <span className="stack" style={{ gap: 2 }}>
          <span className="hand" style={{ fontSize: 22, lineHeight: 1, color: 'inherit' }}>Neues Rezept</span>
          <span className="m-hint" style={{ fontSize: 12 }}>Name, Zutaten und Schritte eintippen</span>
        </span>
      </Link>

      <div className="m-grid">
        {list.map((r) => {
          const kind = tileKind(r)
          const meta = [minutes(r.time_min), isThermomix(r.devices) ? 'Thermomix' : null].filter(Boolean).join(' · ')
          return (
            <Link key={r.id} to={`/mila/gerichte/${r.id}`} className="m-tile">
              <span className={'m-tile__pic m-tile__pic--' + kind}>
                <TileIcon kind={kind} />
              </span>
              <span className="m-tile__text">
                <span className="m-tile__name">{r.name}</span>
                {meta && <span className="m-tile__meta">{meta}</span>}
              </span>
            </Link>
          )
        })}
      </div>
      {list.length === 0 && <p className="m-hint">Nichts in dieser Kategorie.</p>}
    </MilaPage>
  )
}
