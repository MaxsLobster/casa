// Mila · Woche: nach der Aufdeckung die Treffer und die verteilte Woche (Ziehen, „Woche übernehmen“),
// sonst die Woche mit Mittag und Abend. Antippen öffnet die Rezeptkarte, × nimmt das Gericht heraus.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'
import { cookOn, dayInfo, servingsFor, shortName, workDays } from './engine'
import { countdown } from './Wochenwahl'
import { komboDays, type DayDish } from './wahl'
import { weekKey } from './week-list'
import { Sheet } from '../components/ui'
import { SwipeRemove } from './SwipeRemove'
import { useCasa } from '../state/HouseholdContext'
import type { MealSlot, MilaMenu, MilaPlan, MilaRecipe } from '../lib/types'
import { addDays, fromISO, isoWeek, startOfWeek, today, weekDates, weekRange, weekdayShort } from '../lib/dates'

export function Woche() {
  // Erst nach dem Laden aufbauen, damit gleich die richtige Woche offen ist
  const { ready } = useMila()
  if (!ready) return <MilaPage>{null}</MilaPage>
  return <WeekView />
}

/** Treffer der Wochenkarte: nur eine Liste. Antippen legt ein Gericht auf einen Tag, Mila verteilt nichts von selbst. */
function Hits({ menu, plan, placed, onPick }: { menu: MilaMenu; plan: MilaPlan; placed: Set<string>; onPick: (recipeId: string, meal: MealSlot) => void }) {
  const { recipeById, members, me } = useMila()
  const all = [...plan.hits, ...plan.reserve]
  const hits = all.filter((h) => h.kind !== 'aufgefuellt')
  const single = all.filter((h) => h.kind === 'aufgefuellt' && h.points > 0)
  const treffer = hits.filter((h) => h.kind === 'treffer').length
  const jokers = hits.filter((h) => h.kind === 'joker').length
  const nameOf = (id: string) => (id === me.id ? 'von dir' : (members.find((m) => m.id === id)?.display_name ?? ''))
  const headline = plan.voters.length === 0 ? 'Niemand hat gewählt' : treffer === 1 ? '1 Treffer!' : `${treffer} Treffer!`
  const sub = [jokers === 1 ? 'plus ein Joker' : jokers > 1 ? `plus ${jokers} Joker` : null, 'antippen legt ein Gericht auf einen Tag'].filter(Boolean).join(' · ')
  const row = (h: MilaPlan['hits'][number]) => {
    const r = recipeById(h.recipe_id)
    if (!r) return null
    const note = [h.meal === 'abend' ? 'Abend' : 'Mittag', h.kind === 'joker' ? 'Joker ' + h.joker_by.map(nameOf).join(' + ') : null, placed.has(h.recipe_id) ? 'steht in der Woche' : null].filter(Boolean).join(' · ')
    return (
      <button type="button" key={h.meal + h.recipe_id} className={'m-hit' + (placed.has(h.recipe_id) ? ' m-hit--reserve' : '')} onClick={() => onPick(h.recipe_id, h.meal)}>
        <span className={'m-hit__badge m-hit__badge--' + h.kind}>{h.kind === 'joker' ? '★' : h.kind === 'treffer' ? '✓✓' : '✓'}</span>
        <span className="m-hit__name">{r.name}</span>
        <span className="m-hit__note">{note}</span>
      </button>
    )
  }
  return (
    <section className="m-group">
      <div className="m-reveal">
        <span className="m-reveal__big" key={menu.id}>{headline}</span>
        <span className="m-hint">{sub}</span>
      </div>
      {hits.map(row)}
      {single.length > 0 && <h2 className="m-group__label" style={{ marginTop: 10 }}>Nur einer wollte</h2>}
      {single.map(row)}
    </section>
  )
}

function WeekView() {
  const { recipes, weekDays, recipeById, menus, me, ctx, items, setMeal, removeMeal, weekToList, wahl, markDay, moveMeal } = useMila()
  const casa = useCasa()
  const nav = useNavigate()
  // Ist die Karte für die nächste Woche aufgedeckt (oder dort schon etwas eingetragen), gleich dort öffnen
  const [monday, setMonday] = useState(() => {
    const next = addDays(startOfWeek(today()), 7)
    return menus.some((m) => m.week === next && m.revealed_at) || weekDays.some((w) => w.recipe_id && w.date >= next) ? next : startOfWeek(today())
  })
  const [place, setPlace] = useState<{ recipeId: string; meal: MealSlot } | null>(null)
  const [listed, setListed] = useState(false)
  const [pick, setPick] = useState<{ date: string; meal: MealSlot } | null>(null)

  // Entfernt: kurz „Rückgängig“ anbieten
  const [undo, setUndo] = useState<{ name: string; run: () => Promise<void> } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 8000)
    return () => window.clearTimeout(t)
  }, [undo])
  async function remove(date: string, meal: MealSlot) {
    const name = recipeById(day(date, meal)?.recipe_id)?.name ?? 'Gericht'
    const run = await removeMeal(date, meal)
    setListed(false)
    if (run) setUndo({ name: shortName(name), run })
  }

  const dates = weekDates(monday)
  const work = workDays(monday)
  // Kombo und „Was es gibt“ aus denselben Daten: übernommene Kombo der gezeigten Woche auf die Tage verteilt
  const kPlan = [wahl.currentPlan, wahl.nextPlan].find((p) => p && p.week === monday && p.adopted_at && p.status !== 'verworfen') ?? null
  const dishes = kPlan ? komboDays(dates, wahl.itemsOf(kPlan.id), weekDays, today(), kPlan.prep_tag) : null
  const [busyDay, setBusyDay] = useState<string | null>(null)
  async function dayAction(date: string, what: 'Reste' | 'auswärts' | 'verschieben' | 'zurück', dd: DayDish | undefined) {
    setBusyDay(date)
    try {
      if (what === 'zurück') await markDay(date, 'abend', null)
      else if (what === 'verschieben') {
        if (dd?.kind === 'manual') await moveMeal(date, 'abend')
        else await markDay(date, 'abend', 'frei')
      } else await markDay(date, 'abend', what)
      setListed(false)
    } finally {
      setBusyDay(null)
    }
  }
  const nextMonday = addDays(startOfWeek(today()), 7)
  const np = wahl.nextPlan
  const plan = !np
    ? { text: 'Gerichte für nächste Woche wählt ihr ab Freitag', link: '/mila/gerichte?vormerken=1', cta: 'Schon mal Gerichte vormerken ›' }
    : np.status === 'wischen'
      ? { text: `Nächste Woche wählen · ${countdown(np.deadline).replace(/^noch /, 'noch ')}`, link: '/mila/wahl', cta: 'Zur Wahl ›' }
      : np.status === 'kombo'
        ? { text: 'Kombo für nächste Woche steht', link: '/mila/wahl', cta: 'Ansehen und übernehmen ›' }
        : { text: 'Nächste Woche steht', link: monday === nextMonday ? '/mila/wahl' : null, cta: monday === nextMonday ? 'Kombo ansehen ›' : null }
  const day = (date: string, meal: MealSlot) => weekDays.find((w) => w.date === date && w.meal === meal) ?? null

  // Treffer der gezeigten Woche und was davon schon eingetragen ist
  const weekMenu = menus.find((m) => m.week === monday && m.revealed_at && m.plan) ?? null
  const inWeek = weekDays.filter((w) => w.recipe_id && dates.includes(w.date))
  const placed = new Set(inWeek.map((w) => w.recipe_id as string))
  const wkKey = weekKey(monday)
  const onList = items.filter((i) => !i.checked && i.source_week === wkKey).length
  /** Portionen nach Anwesenden an dem Tag */
  const portions = (date: string, meal: MealSlot) => servingsFor(dayInfo(date, ctx), meal)
  async function toList() {
    await weekToList(monday)
    setListed(true)
  }


  return (
    <MilaPage>
      <header className="m-wk">
        <button type="button" className="m-wk__arrow" aria-label="Vorige Woche" onClick={() => setMonday(addDays(monday, -7))}>‹</button>
        <div className="m-wk__mid">
          <span className="m-title">Essensplan</span>
          <span className="m-sub">KW {isoWeek(monday)} · {weekRange(monday)}</span>
        </div>
        <button type="button" className="m-wk__arrow" aria-label="Nächste Woche" onClick={() => setMonday(addDays(monday, 7))}>›</button>
      </header>
      {/* Woche planen und Wahl liegen hier mit drin */}
      <div className="m-plancard">
        <span className="m-plancard__text">{plan.text}</span>
        {plan.link && plan.cta && <Link to={plan.link} className="m-day__link">{plan.cta}</Link>}
      </div>
      <div className="between">
        <span className="m-hint" style={{ fontSize: 12.5 }}>{kPlan ? 'Kombo in Kochreihenfolge auf die Tage verteilt' : ''}</span>
        <Link to="/mila/gerichte" className="m-day__link">Alle Gerichte ›</Link>
      </div>

      {weekMenu?.plan && <Hits menu={weekMenu} plan={weekMenu.plan} placed={placed} onPick={(recipeId, meal) => setPlace({ recipeId, meal })} />}

      <div className="m-days">
        {dates.map((date) => {
          const isWork = work.includes(date)
          const meals: MealSlot[] = isWork || day(date, 'mittag') ? ['mittag', 'abend'] : ['abend']
          return (
            <div key={date} className={'m-day' + (date === today() ? ' m-day--today' : '')}>
              {meals.map((meal, i) => {
                const w = day(date, meal)
                const dd = dishes?.[date]?.[meal]
                const fromKombo = !w?.recipe_id && (dd?.kind === 'kombo' || dd?.kind === 'cooked')
                const r = recipeById(w?.recipe_id ?? (fromKombo ? dd?.recipeId : null))
                const mark = !w?.recipe_id && w?.free_text ? w.free_text : null
                const cook = meal === 'abend' ? cookOn(date, ctx) : null
                let sub = ''
                if (meal === 'mittag' && (w?.recipe_id || fromKombo)) sub = (w?.is_leftover || dd?.leftover) ? 'Reste · aufwärmen' : 'aus der Box'
                if (fromKombo && meal === 'abend') sub = dd?.kind === 'cooked' ? 'gekocht ✓' : 'aus der Kombo'
                if (mark) sub = ''
                if (meal === 'abend' && cook && !cook.open && cook.value) sub = cook.member?.id === me.id ? 'du kochst' : cook.member ? `${cook.value} kocht` : `Essen ${cook.value}`
                const body = (
                  <div className="m-meal">
                    <span className="m-day__when">
                      {i === 0 && (
                        <>
                          <span className="m-day__wd">{weekdayShort(date)}</span>
                          <span className="m-day__date">{fromISO(date).getDate()}.{fromISO(date).getMonth() + 1}.</span>
                        </>
                      )}
                    </span>
                    <button type="button" className="m-meal__row" onClick={() => (w?.recipe_id ? nav(`/mila/rezept/${w.recipe_id}?tag=${date}&m=${meal}`) : r ? nav(`/mila/rezept/${r.id}`) : mark ? undefined : setPick({ date, meal }))}>
                      <span className="m-day__mid">
                        <span className={'m-day__mode m-day__mode--' + (meal === 'abend' ? 'navy' : 'gold')}>{meal === 'abend' ? 'Abend' : 'Mittag'}</span>
                        {mark ? (
                          <span className="m-day__free m-day__mark">{mark === 'frei' ? 'frei · verschoben' : mark}</span>
                        ) : r ? (
                          <span className={'m-day__dish' + ((w?.is_leftover || dd?.leftover) ? ' m-day__dish--left' : '')}>{(w?.is_leftover || dd?.leftover) ? `${shortName(r.name)} vom Vortag` : r.name}</span>
                        ) : (
                          <span className="m-day__free">frei</span>
                        )}
                        {sub && <span className="m-day__sub">{sub}</span>}
                      </span>
                      <span className="m-day__right">
                        {r && !mark && !(w?.is_leftover || dd?.leftover) && isThermomix(r.devices) && <span className="m-tm">TM</span>}
                        {r && !mark && !(w?.is_leftover || dd?.leftover) && <span className="m-day__time">{minutes(r.time_min)}</span>}
                      </span>
                    </button>
                    {r && w?.recipe_id && (
                      <button type="button" className="m-meal__x" aria-label={`${r.name} entfernen`} onClick={() => remove(date, meal)}>×</button>
                    )}
                    {meal === 'abend' && cook?.open && date >= today() && (
                      <div className="m-meal__take">
                        <button type="button" className="m-chip m-chip--small" onClick={() => casa.setOverride({ date, slot: 'abend_essen', value: me.display_name })}>Kochen offen · übernehmen</button>
                      </div>
                    )}
                  </div>
                )
                const acts = meal === 'abend' && date >= today() && (
                      <div className="m-dayacts" aria-label="Für diesen Tag">
                        {mark ? (
                          <button type="button" disabled={busyDay === date} onClick={() => void dayAction(date, 'zurück', dd)}>zurück</button>
                        ) : (
                          <>
                            <button type="button" disabled={busyDay === date} onClick={() => void dayAction(date, 'Reste', dd)}>Reste</button>
                            <button type="button" disabled={busyDay === date} onClick={() => void dayAction(date, 'auswärts', dd)}>auswärts</button>
                            {r && <button type="button" disabled={busyDay === date} onClick={() => void dayAction(date, 'verschieben', dd)}>verschieben</button>}
                          </>
                        )}
                      </div>
                    )
                return (
                  <div key={meal}>
                    {w?.recipe_id ? <SwipeRemove onRemove={() => remove(date, meal)}>{body}</SwipeRemove> : body}
                    {acts}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {undo && (
        <div className={'m-undo' + (inWeek.length > 0 ? ' m-undo--bar' : '')} role="status">
          <span className="m-undo__text">{undo.name} entfernt</span>
          <button type="button" className="m-undo__btn" onClick={() => { const u = undo; setUndo(null); void u.run() }}>Rückgängig</button>
        </div>
      )}

      {inWeek.length > 0 && (
        <>
          <div className="m-week-pad" aria-hidden />
          <div className="m-weekbar">
            {listed || (onList > 0 && !listed) ? (
              <div className="between" style={{ gap: 10 }}>
                <Link to="/mila/einkauf" className="m-weekbar__done" style={{ flex: 1 }}>{onList} auf dem Zettel · ansehen ›</Link>
                <button type="button" className="m-bar__ghost" onClick={toList}>neu</button>
              </div>
            ) : (
              <button type="button" className="m-bar__main" onClick={toList}>Zutaten auf den Zettel</button>
            )}
          </div>
        </>
      )}

      {place && (
        <Sheet onClose={() => setPlace(null)} title="Tag wählen">
          <div className="stack" style={{ gap: 4 }}>
            <span className="m-group__label">{recipeById(place.recipeId)?.name} · an welchem Tag?</span>
            <div className="m-chips" role="radiogroup">
              {(['abend', 'mittag'] as MealSlot[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={place.meal === m} className={'m-chip m-chip--small' + (place.meal === m ? ' m-chip--on' : '')} onClick={() => setPlace({ ...place, meal: m })}>{m === 'abend' ? 'Abend' : 'Mittag'}</button>
              ))}
            </div>
            {dates.map((d) => {
              const cur = recipeById(day(d, place.meal)?.recipe_id)
              return (
                <button key={d} type="button" className="m-dayopt" onClick={() => { setMeal(d, place.meal, place.recipeId, portions(d, place.meal)); setListed(false); setPlace(null) }}>
                  <span className="m-day__when">
                    <span className="m-day__wd">{weekdayShort(d)}</span>
                    <span className="m-day__date">{fromISO(d).getDate()}.{fromISO(d).getMonth() + 1}.</span>
                  </span>
                  {cur ? <span className="m-dayopt__current">{cur.name}</span> : <span className="m-dayopt__free">frei</span>}
                </button>
              )
            })}
          </div>
        </Sheet>
      )}

      {pick && (
        <AllDishes
          recipes={recipes}
          current={day(pick.date, pick.meal)?.recipe_id ?? null}
          title={`${weekdayShort(pick.date)} ${fromISO(pick.date).getDate()}.${fromISO(pick.date).getMonth() + 1}. · ${pick.meal === 'abend' ? 'Abend' : 'Mittag'}`}
          onPick={(rec) => {
            setMeal(pick.date, pick.meal, rec.id, portions(pick.date, pick.meal))
            setListed(false)
            setPick(null)
          }}
          onClose={() => setPick(null)}
        />
      )}
    </MilaPage>
  )
}

/** Blatt: alle Gerichte durchsuchen und auswählen */
function AllDishes({ recipes, current, title, onPick, onClose }: { recipes: MilaRecipe[]; current: string | null; title: string; onPick: (r: MilaRecipe) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...recipes].filter((r) => !needle || r.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [recipes, q])
  return (
    <Sheet onClose={onClose} title={'Gericht für ' + title}>
      <div className="stack" style={{ gap: 10 }}>
        <div className="between">
          <span className="m-group__label" style={{ margin: 0 }}>Gericht für {title}</span>
          <button type="button" className="link" onClick={onClose}>Schließen</button>
        </div>
        <input type="search" className="m-input" placeholder="Suchen …" aria-label="Gerichte durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <div className="stack" style={{ gap: 0 }}>
          {list.map((r) => (
            <button key={r.id} type="button" className="m-dayopt" onClick={() => onPick(r)} aria-current={r.id === current ? 'true' : undefined}>
              <span className="m-dayopt__current" style={{ flex: 1 }}>{r.name}</span>
              <span className="m-day__right">
                {isThermomix(r.devices) && <span className="m-tm">TM</span>}
                <span className="m-day__time">{minutes(r.time_min)}</span>
              </span>
            </button>
          ))}
          {list.length === 0 && <p className="m-hint">Nichts gefunden.</p>}
        </div>
      </div>
    </Sheet>
  )
}
