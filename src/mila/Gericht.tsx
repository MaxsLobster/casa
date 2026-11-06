// Mila · Gericht (Detail): Portionen, Zutaten, Valerie-Zettel, In die Woche, Kochen
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MilaTop } from './Mila'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'
import { CATEGORY_LABELS, scaleAmount, tileKind } from './portions'
import { formatAmount } from './shopping'
import { PlayIcon, TileIcon } from './icons'
import { Sheet } from '../components/ui'
import { addDays, fromISO, startOfWeek, today, weekdayShort } from '../lib/dates'
import type { MealSlot } from '../lib/types'

export function Gericht() {
  const { id } = useParams()
  const { recipeById, ingredientsOf, weekDays, setMeal, ready } = useMila()
  const nav = useNavigate()
  const recipe = recipeById(id)
  const [portions, setPortions] = useState<number | null>(null)
  const [pick, setPick] = useState(false)
  const [placed, setPlaced] = useState<string | null>(null)
  const [meal, setMealSlot] = useState<MealSlot>('abend')

  if (!ready) return <div className="page"><MilaTop /><span className="hint">Einen Moment …</span></div>
  if (!recipe) {
    return (
      <div className="page">
        <MilaTop />
        <Link to="/mila/gerichte" className="m-back">‹ Gerichte</Link>
        <p className="m-hint">Dieses Gericht gibt es nicht mehr.</p>
      </div>
    )
  }

  const p = portions ?? recipe.portions
  const factor = p / Math.max(1, recipe.portions)
  const ings = ingredientsOf(recipe.id)
  const kind = tileKind(recipe)
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfWeek(today()), i)).filter((d) => d >= today())

  async function place(date: string) {
    setPick(false)
    await setMeal(date, meal, recipe!.id)
    setPlaced(date)
  }

  return (
    <>
      <div className="page m-detail">
        <MilaTop />
        <Link to="/mila/gerichte" className="m-back" style={{ alignSelf: 'flex-start' }}>‹ Gerichte</Link>

        <div className={'m-hero m-tile__pic--' + kind}>
          <TileIcon kind={kind} size={64} />
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h1 className="m-detail__name">{recipe.name}</h1>
          <div className="m-detail__meta">
            {recipe.time_min ? <span>{minutes(recipe.time_min)}</span> : null}
            {isThermomix(recipe.devices) && <span className="m-tm">TM</span>}
            <span>{CATEGORY_LABELS[recipe.category]}</span>
            {recipe.valerie_mag && <span style={{ color: 'var(--brown)' }}>Valerie mag’s</span>}
            {recipe.cook_double && <span>doppelt → Mittag</span>}
            {recipe.prep_box && <span>Prep-Box</span>}
            <Link to={`/mila/gerichte/${recipe.id}/bearbeiten`} className="m-detail__edit">Bearbeiten</Link>
          </div>
        </div>

        <div className="m-portions">
          <span className="m-group__label" style={{ margin: 0 }}>Portionen</span>
          <span className="m-portions__ctl">
            <button type="button" className="m-portions__btn" aria-label="Weniger Portionen" disabled={p <= 1} onClick={() => setPortions(p - 1)}>−</button>
            <span key={p} className="m-portions__num">{p}</span>
            <button type="button" className="m-portions__btn" aria-label="Mehr Portionen" onClick={() => setPortions(p + 1)}>+</button>
          </span>
        </div>

        <section className="stack" style={{ gap: 0 }}>
          <h2 className="m-group__label" style={{ marginBottom: 4 }}>Zutaten</h2>
          {ings.map((i) => (
            <div key={i.id} className="m-ing">
              <span className="m-ing__amt">{formatAmount(scaleAmount(i.amount, i.unit, factor), i.unit)}</span>
              <span className="m-ing__name">{i.name}</span>
            </div>
          ))}
          {ings.length === 0 && <p className="m-hint">Noch keine Zutaten eingetragen.</p>}
        </section>

        {recipe.valerie_note && (
          <div className="m-zettel">
            <span className="m-zettel__label">Für Valerie</span>
            <span className="m-zettel__text">{recipe.valerie_note}</span>
          </div>
        )}

        {recipe.notes && <p className="m-hint" style={{ whiteSpace: 'pre-line' }}>{recipe.notes}</p>}

        {placed && (
          <p className="hand hand--brown fade-in" style={{ fontSize: 21 }}>
            Steht am {weekdayShort(placed)} {fromISO(placed).getDate()}.{fromISO(placed).getMonth() + 1}. in der Woche. <Link to="/mila/woche" className="link">Ansehen ›</Link>
          </p>
        )}
        <div style={{ height: 8 }} />
      </div>

      <div className="m-bar">
        <button type="button" className="m-bar__ghost" onClick={() => setPick(true)}>In die Woche</button>
        <button type="button" className="m-bar__main" onClick={() => nav(`/mila/kochen/${recipe.id}?p=${p}`)}>
          <PlayIcon />
          Kochen
        </button>
      </div>

      {pick && (
        <Sheet onClose={() => setPick(false)} title="Tag wählen">
          <div className="stack" style={{ gap: 4 }}>
            <span className="m-group__label">An welchem Tag?</span>
            <div className="m-chips" role="radiogroup">
              {(['abend', 'mittag'] as MealSlot[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={meal === m} className={'m-chip m-chip--small' + (meal === m ? ' m-chip--on' : '')} onClick={() => setMealSlot(m)}>{m === 'abend' ? 'Abend' : 'Mittag'}</button>
              ))}
            </div>
            {days.map((d) => {
              const w = weekDays.find((x) => x.date === d && x.meal === meal)
              const current = w?.recipe_id ? recipeById(w.recipe_id)?.name : w?.free_text
              return (
                <button key={d} type="button" className="m-dayopt" onClick={() => place(d)}>
                  <span className="m-day__when">
                    <span className="m-day__wd">{weekdayShort(d)}</span>
                    <span className="m-day__date">{fromISO(d).getDate()}.{fromISO(d).getMonth() + 1}.</span>
                  </span>
                  <span className="m-day__mid">
                    <span className="m-day__mode m-day__mode--grey">{meal === 'abend' ? 'Abend' : 'Mittag'}</span>
                    {current ? <span className="m-dayopt__current">{current}</span> : <span className="m-dayopt__free">frei</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </Sheet>
      )}
    </>
  )
}
