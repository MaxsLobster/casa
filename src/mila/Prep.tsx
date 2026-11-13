// Mila · Prep-Stunde: Schritte der übernommenen Woche (lange und „nebenbei“ zuerst), abhaken live für beide,
// darunter die Boxen mit Klebeband-Etikett.
import { Link } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { prepDate, prepPlan, workDays } from './engine'
import { focusWeek } from './menu-view'
import { useState } from 'react'
import { minutes } from './rhythm'
import { fromISO, weekdayLong, weekdayShort } from '../lib/dates'
import { prepMinutes } from './wahl'
import type { MilaRecipe, MilaWeekPlan } from '../lib/types'

export function Prep() {
  const { wahl } = useMila()
  // Übernommene Kombo: Prep-Plan aus deren Prep-Gerichten
  const plan = [wahl.nextPlan, wahl.currentPlan].find((p) => p?.adopted_at && wahl.itemsOf(p.id).some((i) => i.gruppe === 'prep' && i.status === 'offen' && i.slot !== 'reste')) ?? null
  if (plan) return <KomboPrep plan={plan} />
  return <WochenPrep />
}

/** Prep-Stunde der Kombo: je Gericht die „im Prep“-Schritte (bzw. eigene Prep-Schritte), abhaken live für beide */
function KomboPrep({ plan }: { plan: MilaWeekPlan }) {
  const { wahl, recipeById, stepsOf, prepStepsOf, rhythm } = useMila()
  const items = wahl.itemsOf(plan.id).filter((i) => i.gruppe === 'prep' && i.slot !== 'reste' && i.status !== 'getauscht' && i.status !== 'reserve')
  const recipesIn = items.map((i) => recipeById(i.recipe_id)).filter(Boolean) as MilaRecipe[]
  const total = prepMinutes(recipesIn, (id) => stepsOf(id), prepStepsOf)
  const done = new Set(plan.prep_done)
  const day = plan.prep_tag ?? plan.week
  const rows = items.flatMap((i) => {
    const r = recipeById(i.recipe_id)
    if (!r) return []
    const own = prepStepsOf(r.id)
    const list = own.length
      ? own.map((s) => ({ key: `${i.id}:${s.id}`, title: s.text, text: s.box_label ? `in die Box: ${s.box_label}` : '', min: s.duration_min }))
      : stepsOf(r.id).filter((s) => s.in_prep).map((s) => ({ key: `${i.id}:${s.id}`, title: s.title ?? 'Schritt', text: s.text, min: s.timer_sec ? Math.round(s.timer_sec / 60) : null }))
    return [{ item: i, r, list }]
  })
  const all = rows.flatMap((x) => x.list)
  const left = all.filter((s) => !done.has(s.key)).length
  return (
    <MilaPage>
      <PrepHead when={`${weekdayLong(day)}, ${fromISO(day).getDate()}.${fromISO(day).getMonth() + 1}. · ${rhythm.prep_time}`} />
      <div className="m-chips">
        <span className="m-tag">ca. {total} Min</span>
        <span className="m-tag">{rows.length} {rows.length === 1 ? 'Box' : 'Boxen'}</span>
        <span className="m-tag">{left === 0 ? 'alles erledigt' : `${left} offen`}</span>
      </div>
      {rows.map(({ item, r, list }) => (
        <section key={item.id} className="m-group">
          <h2 className="m-group__label">{r.name}{item.frist_bis ? ` · Box hält bis ${weekdayShort(item.frist_bis)}` : ''}</h2>
          {r.prep_info?.satz && <p className="m-hint" style={{ margin: '0 0 4px' }}>{r.prep_info.satz}</p>}
          {list.map((p) => {
            const d = done.has(p.key)
            return (
              <button key={p.key} type="button" className={'m-prep' + (d ? ' m-prep--done' : '')} onClick={() => void wahl.togglePlanPrep(plan, p.key)} aria-pressed={d}>
                <span className={'m-check' + (d ? ' m-check--done' : '')}>
                  {d && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                <span className="m-prep__text">
                  <span className="m-prep__t">{p.title}</span>
                  {p.text && <span className="m-prep__meta" style={{ whiteSpace: 'pre-line' }}>{p.text}{p.min ? ` · ${p.min} Min` : ''}</span>}
                </span>
              </button>
            )
          })}
        </section>
      ))}
    </MilaPage>
  )
}

function WochenPrep() {
  const { menus, weekDays, recipes, prepSteps, rhythm, togglePrep } = useMila()
  const [local, setLocal] = useState<string[]>([])
  const week = focusWeek(weekDays)
  const menu = menus.find((m) => m.week === week) ?? null
  const day = prepDate(week, rhythm)
  const dates = workDays(week)
  const rows = weekDays.filter((w) => dates.includes(w.date))
  if (rows.filter((w) => w.recipe_id).length === 0) {
    return (
      <MilaPage>
        <PrepHead when={`${weekdayLongFor(rhythm.prep_weekday)} ${rhythm.prep_time}`} />
        <p className="m-hint">Noch keine Gerichte in der Woche. Der Prep-Plan entsteht, sobald ihr welche eintragt.</p>
        <Link to="/mila/woche" className="link" style={{ alignSelf: 'flex-start' }}>Zur Woche ›</Link>
      </MilaPage>
    )
  }
  const plan = prepPlan(rows, day, recipes, prepSteps)
  const done = new Set(menu ? menu.prep_done : local)
  const toggle = (key: string) => (menu ? togglePrep(menu, key) : setLocal((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key])))
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
              <button key={p.key} type="button" className={'m-prep' + (d ? ' m-prep--done' : '')} onClick={() => toggle(p.key)} aria-pressed={d}>
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
