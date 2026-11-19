// Mila · ruhiger Einstieg: nur „Diese Woche“ (geplante Gerichte kompakt), darunter Einkaufsliste und Woche planen.
// Alles andere (Heute dran, Wahl, Woche, Prep, Fundus) eine Ebene tiefer unter „Mehr“.
import { Link, useNavigate } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { shortName } from './engine'
import { GROUPS } from './Kombo'
import { addDays, fromISO, startOfWeek, today as todayISO, weekDates, weekdayShort } from '../lib/dates'
import type { MilaPlanItem } from '../lib/types'

export function Start() {
  const { wahl, weekDays, recipeById, items } = useMila()
  const nav = useNavigate()
  const today = todayISO()
  const monday = startOfWeek(today)
  const dates = weekDates(monday)
  const plan = wahl.currentPlan?.adopted_at ? wahl.currentPlan : null
  const kombo = plan ? wahl.itemsOf(plan.id).filter((i) => i.status === 'offen' || i.status === 'gekocht') : []
  const days = weekDays.filter((w) => w.recipe_id && dates.includes(w.date)).sort((a, b) => a.date.localeCompare(b.date) || (a.meal === 'mittag' ? -1 : 1))
  const onList = items.filter((i) => !i.checked && !i.is_stock).length
  const wahlOpen = wahl.nextPlan?.status === 'wischen'
  const a = fromISO(monday)
  const b = fromISO(addDays(monday, 6))

  return (
    <MilaPage>
      <header className="stack stack--tight">
        <span className="m-sub">{a.getDate()}.{a.getMonth() + 1}. – {b.getDate()}.{b.getMonth() + 1}.</span>
        <span className="m-title" style={{ fontSize: 41.5, lineHeight: 0.95 }}>Diese Woche</span>
      </header>

      {plan ? (
        <div className="ms__list">
          {GROUPS.map((g) => {
            const list = kombo.filter((i) => i.gruppe === g.id)
            if (!list.length) return null
            return list.map((i) => <KomboLine key={i.id} i={i} onOpen={() => nav(`/mila/rezept/${i.recipe_id}`)} />)
          })}
          {kombo.length === 0 && <p className="m-hint">Alles aus der Kombo ist weg.</p>}
        </div>
      ) : days.length ? (
        <div className="ms__list">
          {days.map((w) => {
            const r = recipeById(w.recipe_id)
            if (!r) return null
            return (
              <button key={w.id} type="button" className={'ms__row' + (w.date < today ? ' ms__row--past' : '')} onClick={() => nav(`/mila/rezept/${r.id}?tag=${w.date}&m=${w.meal}`)}>
                <span className="ms__when">{weekdayShort(w.date)}{w.meal === 'mittag' ? ' · Mittag' : ''}</span>
                <span className="ms__dish">{w.is_leftover ? `Reste: ${shortName(r.name)}` : r.name}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="m-hint">Für diese Woche ist noch nichts geplant.</p>
      )}

      <div className="ms__buttons">
        <Link to="/mila/einkauf" className="rk-btn rk-btn--ghost ms__btn">Einkaufsliste{onList ? ` · ${onList}` : ''}</Link>
        <Link to={wahlOpen || wahl.nextPlan ? '/mila/wahl' : '/mila/woche'} className="rk-btn rk-btn--main ms__btn">Woche planen{wahlOpen ? ' · Wahl läuft' : ''}</Link>
      </div>

      <nav className="ms__more" aria-label="Mehr von Mila">
        <span className="ms__more-label">Mehr</span>
        <Link to="/mila/heute">Heute dran</Link>
        <Link to="/mila/wahl">Wahl</Link>
        <Link to="/mila/woche">Woche</Link>
        <Link to="/mila/prep">Prep</Link>
        <Link to="/mila/gerichte">Fundus</Link>
      </nav>
    </MilaPage>
  )
}

function KomboLine({ i, onOpen }: { i: MilaPlanItem; onOpen: () => void }) {
  const { recipeById } = useMila()
  const r = recipeById(i.recipe_id)
  if (!r) return null
  const done = i.status === 'gekocht'
  return (
    <button type="button" className={'ms__row' + (done ? ' ms__row--past' : '')} onClick={onOpen}>
      <span className="ms__when">{done ? `✓ ${i.gekocht_am ? weekdayShort(i.gekocht_am) : ''}` : i.slot === 'abend' ? 'Abend' : 'Mittag'}</span>
      <span className="ms__dish">{i.slot === 'reste' ? `Reste: ${shortName(r.name)}` : r.name}</span>
    </button>
  )
}
