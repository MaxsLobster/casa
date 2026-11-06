// Mila · Woche: nach der Aufdeckung die Treffer und die verteilte Woche (Ziehen, „Woche übernehmen“),
// sonst die Woche mit Mittag und Abend. Antippen: kochen, Rezept, tauschen, leeren.
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'
import { cookOn, shortName, workDays } from './engine'
import { deadline, openMenu } from './menu-view'
import { Sheet } from '../components/ui'
import { useCasa } from '../state/HouseholdContext'
import type { MealSlot, MilaMenu, MilaPlan, MilaRecipe, MilaWeekDay, PlanSlot } from '../lib/types'
import { addDays, fromISO, isoWeek, startOfWeek, today, weekDates, weekRange, weekdayShort } from '../lib/dates'

export function Woche() {
  const { menus } = useMila()
  const menu = openMenu(menus)
  const [showWeek, setShowWeek] = useState(false)
  if (menu?.revealed_at && menu.plan && !showWeek) return <Treffer menu={menu} plan={menu.plan} onWeek={() => setShowWeek(true)} />
  return <WeekView />
}

// ---------------------------------------------------------------------------
// Aufdeckung
// ---------------------------------------------------------------------------

function Treffer({ menu, plan, onWeek }: { menu: MilaMenu; plan: MilaPlan; onWeek: () => void }) {
  const { recipeById, members, me, reorder, adopt } = useMila()
  const [busy, setBusy] = useState(false)
  const treffer = [...plan.hits, ...plan.reserve].filter((h) => h.kind === 'treffer').length
  const jokers = plan.hits.filter((h) => h.kind === 'joker').length
  const meals = plan.slots.length
  const nameOf = (id: string) => (id === me.id ? 'du' : (members.find((m) => m.id === id)?.display_name ?? ''))
  const plus = jokers === 1 ? 'plus ein Joker' : jokers > 1 ? `plus ${jokers} Joker` : ''
  const headline = plan.voters.length === 0 ? 'Mila hat gewürfelt' : treffer === 1 ? '1 Treffer!' : `${treffer} Treffer!`
  const sub = [plan.voters.length === 0 ? 'Niemand hat gewählt' : plan.voters.length === 1 ? `Nur ${nameOf(plan.voters[0]) === 'du' ? 'du hast' : nameOf(plan.voters[0]) + ' hat'} gewählt` : null, plus, `${meals} Mahlzeiten stehen`].filter(Boolean).join(' · ')

  const mark = (k: string) => (k === 'joker' ? '★' : k === 'treffer' ? '✓✓' : '+')
  const noteOf = (h: MilaPlan['hits'][number], reserve = false) => {
    const r = recipeById(h.recipe_id)
    const parts = [h.meal === 'abend' ? 'Abend' : 'Mittag']
    if (reserve) return 'Reserve · ' + parts[0]
    if (h.meal === 'abend' && r?.cook_double && plan.slots.some((s) => s.leftover && s.recipe_id === h.recipe_id)) parts.push('doppelt')
    if (h.kind === 'joker') parts.push('Joker ' + h.joker_by.map((id) => (id === me.id ? 'von dir' : nameOf(id))).join(' + '))
    if (h.kind === 'aufgefuellt') parts.push('aufgefüllt')
    return parts.join(' · ')
  }

  async function take() {
    setBusy(true)
    await adopt(menu)
    setBusy(false)
  }

  return (
    <MilaPage>
      <header className="m-head">
        <span className="m-sub">Aufdeckung · KW {isoWeek(menu.week)}</span>
        <span className="m-title">Eure Woche</span>
      </header>

      <div className="m-reveal">
        <span className="m-reveal__big">{headline}</span>
        <span className="m-hint">{sub}</span>
      </div>

      <section className="m-group">
        <h2 className="m-group__label">Treffer</h2>
        {plan.hits.map((h) => (
          <div key={h.meal + h.recipe_id} className="m-hit">
            <span className={'m-hit__badge m-hit__badge--' + h.kind}>{mark(h.kind)}</span>
            <span className="m-hit__name">{recipeById(h.recipe_id)?.name ?? '—'}</span>
            <span className="m-hit__note">{noteOf(h)}</span>
          </div>
        ))}
        {plan.reserve.map((h) => (
          <div key={'r' + h.meal + h.recipe_id} className="m-hit m-hit--reserve">
            <span className="m-hit__badge m-hit__badge--reserve">{mark(h.kind)}</span>
            <span className="m-hit__name">{recipeById(h.recipe_id)?.name ?? '—'}</span>
            <span className="m-hit__note">{noteOf(h, true)}</span>
          </div>
        ))}
      </section>

      <section className="m-group">
        <h2 className="m-group__label">So sieht eure Woche aus</h2>
        <span className="m-hint" style={{ fontSize: 12 }}>Zum Tauschen ein Gericht am Griff ziehen.</span>
        <PlanList menu={menu} plan={plan} onSwap={(d, l) => reorder(menu, d, l)} />
      </section>

      <button type="button" className="link" style={{ alignSelf: 'center', marginTop: 8 }} onClick={onWeek}>Diese Woche ansehen ›</button>
      <div className="m-week-pad" style={{ height: 130 }} aria-hidden />
      <div className="m-weekbar">
        <button type="button" className="m-bar__main" disabled={busy} onClick={take}>Woche übernehmen</button>
        <span className="m-hint m-weekbar__note">Danach entstehen Einkaufszettel und Prep-Plan. Sonst übernimmt Mila {deadline(menu.adopt_at)} selbst.</span>
      </div>
    </MilaPage>
  )
}

/** Verteilte Woche mit Ziehen: Abend auf Abend tauscht, Mittag auf Mittag tauscht */
function PlanList({ menu, plan, onSwap }: { menu: MilaMenu; plan: MilaPlan; onSwap: (dinners: string[], lunches: string[]) => void }) {
  const { recipeById, ctx, me } = useMila()
  const casa = useCasa()
  const rows = useRef<Record<string, HTMLDivElement | null>>({})
  const [drag, setDrag] = useState<{ key: string; meal: MealSlot; y0: number; dy: number; over: string | null } | null>(null)

  // Reihenfolge: Index in plan.dinners bzw. plan.lunches
  const dinnerSlots = plan.slots.filter((s) => s.meal === 'abend')
  const lunchSlots = plan.slots.filter((s) => s.meal === 'mittag' && !s.leftover)
  const keyOf = (s: PlanSlot) => s.date + s.meal
  const items = [...plan.slots.map((s) => ({ kind: 'slot' as const, s })), ...plan.skipped.map((d) => ({ kind: 'skip' as const, d }))].sort((a, b) => {
    const da = a.kind === 'slot' ? a.s.date + (a.s.meal === 'mittag' ? '0' : '1') : a.d
    const db = b.kind === 'slot' ? b.s.date + (b.s.meal === 'mittag' ? '0' : '1') : b.d
    return da.localeCompare(db)
  })

  function down(e: RPointerEvent<HTMLElement>, s: PlanSlot) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ key: keyOf(s), meal: s.meal, y0: e.clientY, dy: 0, over: null })
  }
  function move(e: RPointerEvent<HTMLElement>) {
    if (!drag) return
    const pool = drag.meal === 'abend' ? dinnerSlots : lunchSlots
    let over: string | null = null
    for (const s of pool) {
      const el = rows.current[keyOf(s)]
      if (!el || keyOf(s) === drag.key) continue
      const r = el.getBoundingClientRect()
      if (e.clientY >= r.top && e.clientY <= r.bottom) over = keyOf(s)
    }
    setDrag({ ...drag, dy: e.clientY - drag.y0, over })
  }
  function up() {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (!d.over) return
    if (d.meal === 'abend') {
      const a = dinnerSlots.findIndex((s) => keyOf(s) === d.key)
      const b = dinnerSlots.findIndex((s) => keyOf(s) === d.over)
      const next = [...plan.dinners]
      ;[next[a], next[b]] = [next[b], next[a]]
      onSwap(next, plan.lunches)
    } else {
      const a = lunchSlots.findIndex((s) => keyOf(s) === d.key)
      const b = lunchSlots.findIndex((s) => keyOf(s) === d.over)
      const next = [...plan.lunches]
      ;[next[a], next[b]] = [next[b], next[a]]
      onSwap(plan.dinners, next)
    }
  }

  return (
    <div className="m-plan">
      {items.map((it) => {
        if (it.kind === 'skip') {
          return (
            <div key={'skip' + it.d} className="m-plan__row m-plan__row--skip">
              <span className="m-plan__day">{weekdayShort(it.d)}</span>
              <span className="m-plan__mid"><span className="m-plan__who">Ihr seid beide weg</span></span>
            </div>
          )
        }
        const s = it.s
        const r = recipeById(s.recipe_id)
        const k = keyOf(s)
        const dragging = drag?.key === k
        const target = drag?.over === k
        const cook = s.meal === 'abend' ? cookOn(s.date, ctx) : null
        const who = s.meal === 'abend'
          ? cook?.open
            ? null
            : cook?.member?.id === me.id
              ? 'du kochst'
              : cook?.value
                ? (cook.member ? `${cook.value} kocht` : `Essen ${cook.value}`)
                : ''
          : s.leftover
            ? 'Reste · aufwärmen'
            : 'fertig in der Box'
        const double = s.meal === 'abend' && plan.slots.some((x) => x.leftover && x.recipe_id === s.recipe_id && x.date === addDays(s.date, 1))
        return (
          <div
            key={k}
            ref={(el) => { rows.current[k] = el }}
            className={'m-plan__row' + (s.leftover ? ' m-plan__row--left' : '') + (dragging ? ' m-plan__row--drag' : '') + (target ? ' m-plan__row--over' : '')}
            style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            <span className="m-plan__day">{weekdayShort(s.date)} · {s.meal === 'abend' ? 'A' : 'M'}</span>
            <span className="m-plan__mid">
              <span className="m-plan__dish">{s.leftover ? `${shortName(r?.name ?? '')} vom Vortag` : (r?.name ?? '—') + (double ? ' (doppelt)' : '')}</span>
              <span className="m-plan__who">
                {who}
                {cook?.open && (
                  <button type="button" className="m-chip m-chip--small" onClick={() => casa.setOverride({ date: s.date, slot: 'abend_essen', value: me.display_name })}>offen · übernehmen</button>
                )}
                {' '}· {s.servings} {s.servings === 1 ? 'Portion' : 'Portionen'}
              </span>
            </span>
            {!s.leftover && (
              <span className="m-plan__grip" aria-label="Ziehen zum Tauschen" onPointerDown={(e) => down(e, s)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M5 8h14M5 12h14M5 16h14" />
                </svg>
              </span>
            )}
          </div>
        )
      })}
      {menu.week && plan.slots.length === 0 && <p className="m-hint">Diese Woche seid ihr beide weg, es gibt nichts zu verteilen.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Woche
// ---------------------------------------------------------------------------

function WeekView() {
  const { recipes, weekDays, recipeById, menus, me, partner, ctx, setMeal } = useMila()
  const casa = useCasa()
  const nav = useNavigate()
  // Steht die nächste Woche schon (übernommen), gleich dort öffnen
  const [monday, setMonday] = useState(() => {
    const next = addDays(startOfWeek(today()), 7)
    return menus.some((m) => m.week === next && m.adopted_at) ? next : startOfWeek(today())
  })
  const [open, setOpen] = useState<{ date: string; meal: MealSlot } | null>(null)
  const [pick, setPick] = useState<{ date: string; meal: MealSlot } | null>(null)

  const dates = weekDates(monday)
  const work = workDays(monday)
  const menu = openMenu(menus)
  const day = (date: string, meal: MealSlot) => weekDays.find((w) => w.date === date && w.meal === meal) ?? null
  const iVoted = menu?.done_by.includes(me.id)

  /** Kochen: Portionen inkl. Reste für den nächsten Mittag */
  function cookPortions(w: MilaWeekDay): number {
    const base = w.servings ?? recipeById(w.recipe_id)?.portions ?? 2
    const left = weekDays.find((x) => x.is_leftover && x.recipe_id === w.recipe_id && x.date === addDays(w.date, 1))
    return base + (left?.servings ?? 0)
  }

  const openRow = open ? day(open.date, open.meal) : null
  const openRecipe = recipeById(openRow?.recipe_id)

  return (
    <MilaPage>
      <header className="m-wk">
        <button type="button" className="m-wk__arrow" aria-label="Vorige Woche" onClick={() => setMonday(addDays(monday, -7))}>‹</button>
        <div className="m-wk__mid">
          <span className="m-title">Was es gibt</span>
          <span className="m-sub">KW {isoWeek(monday)} · {weekRange(monday)}</span>
        </div>
        <button type="button" className="m-wk__arrow" aria-label="Nächste Woche" onClick={() => setMonday(addDays(monday, 7))}>›</button>
      </header>
      <div className="between">
        {menu && !menu.revealed_at ? (
          <Link to="/mila/karte" className="m-banner">
            {iVoted ? `Du hast gewählt${partner && !menu.done_by.includes(partner.id) ? ` · ${partner.display_name} wählt noch` : ''}` : `Die Wochenkarte ist da · bis ${deadline(menu.closes_at)} wählen ›`}
          </Link>
        ) : (
          <span />
        )}
        <Link to="/mila/gerichte" className="m-day__link">Alle Gerichte ›</Link>
      </div>

      <div className="m-days">
        {dates.map((date) => {
          const isWork = work.includes(date)
          const meals: MealSlot[] = isWork || day(date, 'mittag') ? ['mittag', 'abend'] : ['abend']
          return (
            <div key={date} className={'m-day' + (date === today() ? ' m-day--today' : '')}>
              {meals.map((meal, i) => {
                const w = day(date, meal)
                const r = recipeById(w?.recipe_id)
                const cook = meal === 'abend' ? cookOn(date, ctx) : null
                let sub = ''
                if (meal === 'mittag' && w) sub = w.is_leftover ? 'Reste · aufwärmen' : 'aus der Box'
                if (meal === 'abend' && cook && !cook.open && cook.value) sub = cook.member?.id === me.id ? 'du kochst' : cook.member ? `${cook.value} kocht` : `Essen ${cook.value}`
                return (
                  <div key={meal} className="m-meal">
                    <span className="m-day__when">
                      {i === 0 && (
                        <>
                          <span className="m-day__wd">{weekdayShort(date)}</span>
                          <span className="m-day__date">{fromISO(date).getDate()}.{fromISO(date).getMonth() + 1}.</span>
                        </>
                      )}
                    </span>
                    <button type="button" className="m-meal__row" onClick={() => (w ? setOpen({ date, meal }) : setPick({ date, meal }))}>
                      <span className="m-day__mid">
                        <span className={'m-day__mode m-day__mode--' + (meal === 'abend' ? 'navy' : 'gold')}>{meal === 'abend' ? 'Abend' : 'Mittag'}</span>
                        {r ? (
                          <span className={'m-day__dish' + (w?.is_leftover ? ' m-day__dish--left' : '')}>{w?.is_leftover ? `${shortName(r.name)} vom Vortag` : r.name}</span>
                        ) : (
                          <span className="m-day__free">frei</span>
                        )}
                        {sub && <span className="m-day__sub">{sub}</span>}
                      </span>
                      <span className="m-day__right">
                        {r && !w?.is_leftover && isThermomix(r.devices) && <span className="m-tm">TM</span>}
                        {r && !w?.is_leftover && <span className="m-day__time">{minutes(r.time_min)}</span>}
                      </span>
                    </button>
                    {meal === 'abend' && cook?.open && date >= today() && (
                      <div className="m-meal__take">
                        <button type="button" className="m-chip m-chip--small" onClick={() => casa.setOverride({ date, slot: 'abend_essen', value: me.display_name })}>Kochen offen · übernehmen</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {open && openRow && openRecipe && (
        <Sheet onClose={() => setOpen(null)} title={openRecipe.name}>
          <div className="stack" style={{ gap: 12 }}>
            <span className="m-sub">{weekdayShort(open.date)} {fromISO(open.date).getDate()}.{fromISO(open.date).getMonth() + 1}. · {open.meal === 'abend' ? 'Abend' : 'Mittag'}</span>
            <span className="m-title" style={{ fontSize: 30 }}>{openRecipe.name}</span>
            {!openRow.is_leftover && (
              <button type="button" className="m-bar__main" onClick={() => nav(`/mila/kochen/${openRecipe.id}?p=${cookPortions(openRow)}`)}>
                Kochen · {cookPortions(openRow)} Portionen
              </button>
            )}
            <div className="m-day__actions">
              <Link to={`/mila/gerichte/${openRecipe.id}`} className="m-day__link m-day__link--gold">Rezept ansehen ›</Link>
              <button type="button" className="m-day__link" onClick={() => { setPick(open); setOpen(null) }}>Anderes Gericht</button>
              <button type="button" className="m-day__link m-day__link--quiet" onClick={() => { setMeal(open.date, open.meal, null); setOpen(null) }}>Leeren</button>
            </div>
          </div>
        </Sheet>
      )}

      {pick && (
        <AllDishes
          recipes={recipes}
          current={day(pick.date, pick.meal)?.recipe_id ?? null}
          title={`${weekdayShort(pick.date)} ${fromISO(pick.date).getDate()}.${fromISO(pick.date).getMonth() + 1}. · ${pick.meal === 'abend' ? 'Abend' : 'Mittag'}`}
          onPick={(rec) => {
            setMeal(pick.date, pick.meal, rec.id)
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
