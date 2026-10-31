// Mila · Woche (Schritt 3: Gerüst mit Rhythmus, Blättern und Gerichten; Aufklappen kommt in Schritt 6)
import { useState } from 'react'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { RHYTHM, isThermomix, minutes } from './rhythm'
import { addDays, fromISO, isoWeek, startOfWeek, today, weekDates, weekRange, weekdayShort } from '../lib/dates'

export function Woche() {
  const { weekDays, recipeById } = useMila()
  const [monday, setMonday] = useState(() => startOfWeek(today()))
  const dates = weekDates(monday)
  const byDate = new Map(weekDays.map((w) => [w.date, w]))

  return (
    <MilaPage>
      <header className="m-wk">
        <button type="button" className="m-wk__arrow" aria-label="Vorige Woche" onClick={() => setMonday(addDays(monday, -7))}>‹</button>
        <div className="m-wk__mid">
          <span className="m-title">Was es geben könnte</span>
          <span className="m-sub">KW {isoWeek(monday)} · {weekRange(monday)}</span>
        </div>
        <button type="button" className="m-wk__arrow" aria-label="Nächste Woche" onClick={() => setMonday(addDays(monday, 7))}>›</button>
      </header>

      <div className="m-days">
        {dates.map((date, i) => {
          const day = byDate.get(date)
          const recipe = recipeById(day?.recipe_id)
          const dish = recipe?.name ?? day?.free_text ?? null
          const r = RHYTHM[i]
          return (
            <div key={date} className="m-day">
              <div className="m-day__row">
                <span className="m-day__when">
                  <span className="m-day__wd">{weekdayShort(date)}</span>
                  <span className="m-day__date">{fromISO(date).getDate()}.{fromISO(date).getMonth() + 1}.</span>
                </span>
                <span className="m-day__mid">
                  <span className={'m-day__mode m-day__mode--' + r.tone}>{r.label}</span>
                  {dish ? <span className="m-day__dish">{dish}</span> : <span className="m-day__empty">noch offen · Vorschlag?</span>}
                </span>
                <span className="m-day__right">
                  {recipe && isThermomix(recipe.devices) && <span className="m-tm">TM</span>}
                  {recipe && <span className="m-day__time">{minutes(recipe.time_min)}</span>}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </MilaPage>
  )
}
