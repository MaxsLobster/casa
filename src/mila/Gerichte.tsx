// Mila · Gerichte (Fundus): Filter, Kachelraster mit Foto, Neues Rezept. Antippen öffnet die Rezeptkarte.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'
import { tileKind } from './portions'
import { PlusIcon, TileIcon } from './icons'
import type { MilaRecipe } from '../lib/types'

type Filter = 'alle' | 'vorgemerkt' | 'schnell' | 'tm' | 'prep' | 'mittag' | 'grill'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'vorgemerkt', label: '★ Vorgemerkt' },
  { id: 'schnell', label: 'Schnell' },
  { id: 'tm', label: 'Thermomix' },
  { id: 'prep', label: 'Meal-Prep' },
  { id: 'mittag', label: 'Mittag' },
  { id: 'grill', label: 'Grill' },
]

function matches(r: MilaRecipe, f: Filter) {
  if (f === 'alle') return true
  if (f === 'tm') return isThermomix(r.devices)
  if (f === 'prep') return r.prep_box || r.category === 'mealprep'
  if (f === 'mittag') return r.meal === 'mittag' || r.meal === 'beides'
  if (f === 'grill') return r.category === 'grill' || r.devices.includes('bge')
  return (r.time_min ?? 99) <= 25
}

const mealBadge = (r: MilaRecipe) => (r.meal === 'mittag' ? 'Mittag' : r.meal === 'beides' ? 'Mittag & Abend' : 'Abend')

export function Gerichte() {
  const { recipes, photoUrl, wahl } = useMila()
  const [params] = useSearchParams()
  const marking = params.get('vormerken') === '1'
  const [filter, setFilter] = useState<Filter>('alle')
  const list = recipes.filter((r) => (filter === 'vorgemerkt' ? wahl.vorgemerkt.has(r.id) : matches(r, filter))).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const shown = FILTERS.filter((f) => (f.id !== 'grill' || recipes.some((r) => matches(r, 'grill'))) && (f.id !== 'vorgemerkt' || wahl.vorgemerkt.size > 0 || marking))
  const fromHf = recipes.filter((r) => r.hf_id).length

  return (
    <MilaPage>
      <header className="stack stack--tight">
        <span className="m-title" style={{ fontSize: 41.5, lineHeight: 0.95 }}>Unsere Gerichte</span>
        <span className="m-hint" style={{ fontSize: 12.5 }}>
          {filter === 'alle' ? `${recipes.length} Gerichte${fromHf ? `, ${fromHf} aus HelloFresh` : ''}` : `${list.length} von ${recipes.length}`} · Tipp öffnet die Rezeptkarte
        </span>
      </header>

      {marking && <p className="m-banner" style={{ textDecoration: 'none' }}>Tippe ☆ bei einem Gericht: Es kommt sicher in euren nächsten Stapel.</p>}

      <div className="m-chips" role="radiogroup" aria-label="Filter">
        {shown.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={'m-chip' + (filter === f.id ? ' m-chip--on' : '')} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <Link to="/mila/gerichte/neu" className="m-new">
        <PlusIcon />
        <span className="stack" style={{ gap: 2 }}>
          <span className="hand" style={{ fontSize: 23, lineHeight: 1, color: 'inherit' }}>Neues Rezept</span>
          <span className="m-hint" style={{ fontSize: 12.5 }}>Name, Zutaten und Schritte eintippen</span>
        </span>
      </Link>

      <div className="m-grid">
        {list.map((r) => {
          const kind = tileKind(r)
          const n = r.nutrition
          const meta = [minutes(r.time_min), n?.kcal ? `${Math.round(n.kcal)} kcal` : null, n?.protein_g ? `${Math.round(n.protein_g)} g P` : null].filter(Boolean).join(' · ')
          const marks = [r.prep_box ? 'Prep' : null, isThermomix(r.devices) ? 'TM' : null, r.anna?.paprika_ersetzt ? 'Anna ✓' : null].filter(Boolean) as string[]
          const src = photoUrl(r.photo_path)
          return (
            <div key={r.id} className="m-tile-wrap">
            <button type="button" className={'m-star' + (wahl.vorgemerkt.has(r.id) ? ' m-star--on' : '')} aria-pressed={wahl.vorgemerkt.has(r.id)} aria-label={`${r.name} ${wahl.vorgemerkt.has(r.id) ? 'nicht mehr vormerken' : 'vormerken'}`} onClick={() => void wahl.toggleVormerken(r.id)}>
              {wahl.vorgemerkt.has(r.id) ? '★' : '☆'}
            </button>
            <Link to={`/mila/rezept/${r.id}`} state={{ from: 'fundus' }} className="m-tile">
              <span className={'m-tile__pic' + (src ? ' m-tile__pic--photo' : ' m-tile__pic--' + kind)}>
                {src ? <img src={src} alt="" loading="lazy" /> : <TileIcon kind={kind} />}
                {r.hf_id && <span className={'m-tile__badge' + (r.meal === 'mittag' ? ' m-tile__badge--mittag' : '')}>{mealBadge(r)}</span>}
              </span>
              <span className="m-tile__text">
                <span className="m-tile__name">{r.name}</span>
                {meta && <span className="m-tile__meta">{meta}</span>}
                {marks.length > 0 && (
                  <span className="m-tile__marks">
                    {marks.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </span>
                )}
              </span>
            </Link>
            </div>
          )
        })}
      </div>
      {list.length === 0 && <p className="m-hint">{filter === 'vorgemerkt' ? 'Noch nichts vorgemerkt. Tippe ☆ bei einem Gericht.' : 'Nichts in dieser Kategorie.'}</p>}
    </MilaPage>
  )
}
