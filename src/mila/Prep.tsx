// Mila · Prep-Stunde: Schritte der übernommenen Woche (lange und „nebenbei“ zuerst), abhaken live für beide,
// darunter die Boxen mit Klebeband-Etikett.
import { Link } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { prepDate, prepPlan, workDays } from './engine'
import { adoptedMenu } from './menu-view'
import { minutes } from './rhythm'
import { fromISO, weekdayLong } from '../lib/dates'

export function Prep() {
  const { menus, weekDays, recipes, prepSteps, rhythm, togglePrep } = useMila()
  const menu = adoptedMenu(menus)
  if (!menu) {
    return (
      <MilaPage>
        <PrepHead when={`${weekdayLongFor(rhythm.prep_weekday)} ${rhythm.prep_time}`} />
        <p className="m-hint">Noch keine Woche übernommen. Der Prep-Plan entsteht zusammen mit der Woche.</p>
        <Link to="/mila/karte" className="link" style={{ alignSelf: 'flex-start' }}>Zur Wochenkarte ›</Link>
      </MilaPage>
    )
  }
  const day = prepDate(menu.week, rhythm)
  const dates = workDays(menu.week)
  const rows = weekDays.filter((w) => dates.includes(w.date))
  const plan = prepPlan(rows, day, recipes, prepSteps)
  const done = new Set(menu.prep_done)
  const left = plan.items.filter((i) => !done.has(i.key)).length

  return (
    <MilaPage>
      <PrepHead when={`${weekdayLong(day)}, ${fromISO(day).getDate()}.${fromISO(day).getMonth() + 1}. · ${rhythm.prep_time}`} />
      <div className="m-chips">
        <span className="m-tag">ca. {minutes(plan.total) || '0 Min'}</span>
        <span className="m-tag">{plan.boxes.length} {plan.boxes.length === 1 ? 'Box' : 'Boxen'}</span>
        {plan.items.length > 0 && <span className="m-tag">{left === 0 ? 'alles erledigt' : `${left} offen`}</span>}
      </div>

      {plan.items.length === 0 ? (
        <p className="m-hint">Diese Woche gibt es nichts vorzubereiten.</p>
      ) : (
        <section className="m-group">
          <h2 className="m-group__label">Schritte</h2>
          {plan.items.map((p) => {
            const d = done.has(p.key)
            return (
              <button key={p.key} type="button" className={'m-prep' + (d ? ' m-prep--done' : '')} onClick={() => togglePrep(menu, p.key)} aria-pressed={d}>
                <span className={'m-check' + (d ? ' m-check--done' : '')}>
                  {d && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                <span className="m-prep__text">
                  <span className="m-prep__t">{p.text}</span>
                  <span className="m-prep__meta">{p.meta}</span>
                </span>
              </button>
            )
          })}
        </section>
      )}

      {plan.boxes.length > 0 && (
        <section className="m-group">
          <h2 className="m-group__label">Boxen für den Kühlschrank</h2>
          <div className="m-boxes">
            {plan.boxes.map((b) => (
              <div key={b.key} className="m-box">
                <span className={'m-box__tape' + (b.lunch ? ' m-box__tape--lunch' : '')}>{b.day}</span>
                <span className="m-box__what">{b.what}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {plan.tasks.length > 0 && (
        <section className="m-group">
          <h2 className="m-group__label">Erst am Vortag</h2>
          {plan.tasks.map((t) => (
            <p key={t.title + t.date} className="m-hint" style={{ margin: '2px 0' }}>{weekdayLong(t.date)}: {t.title} · steht als Aufgabe in Casa</p>
          ))}
        </section>
      )}
    </MilaPage>
  )
}

function weekdayLongFor(wd: number): string {
  return ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][wd - 1]
}

function PrepHead({ when }: { when: string }) {
  return (
    <header className="m-head">
      <span className="m-sub">{when}</span>
      <span className="m-title">Prep-Stunde</span>
    </header>
  )
}
