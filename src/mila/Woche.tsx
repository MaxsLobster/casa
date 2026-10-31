// Mila · Woche: Rhythmus, Blättern, Tag aufklappen (Tauschen, alle Gerichte, Freitext), Zutaten auf die Liste
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { RHYTHM, isThermomix, minutes } from './rhythm'
import { collectWeek, hashCode, weekKey } from './week-list'
import { Sheet } from '../components/ui'
import type { MilaRecipe, MilaWeekDay } from '../lib/types'
import { addDays, fromISO, isoWeek, startOfWeek, today, weekDates, weekRange, weekdayShort } from '../lib/dates'

export function Woche() {
  const { recipes, weekDays, items, recipeById, ingredientsOf, setWeekDay, addItems, markAddedToList } = useMila()
  const [monday, setMonday] = useState(() => startOfWeek(today()))
  const [open, setOpen] = useState<string | null>(null)
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const dates = weekDates(monday)
  const byDate = new Map(weekDays.map((w) => [w.date, w]))
  const week = dates.map((d) => byDate.get(d)).filter(Boolean) as MilaWeekDay[]
  const planned = new Set(week.map((w) => w.recipe_id).filter(Boolean) as string[])

  // Was noch nicht auf der Liste steht, und was aus dieser Woche schon drauf ist
  const pending = collectWeek(monday, week, recipeById, ingredientsOf)
  const wk = weekKey(monday)
  const onList = items.filter((i) => !i.checked && i.source_week === wk).length

  function turn(n: number) {
    setMonday(addDays(monday, n))
    setOpen(null)
    setJustAdded(false)
  }

  async function choose(date: string, recipe: MilaRecipe) {
    setPickFor(null)
    setOpen(null)
    await setWeekDay(date, { recipe_id: recipe.id, free_text: null })
  }
  async function free(date: string, text: string) {
    const t = text.trim()
    setOpen(null)
    await setWeekDay(date, t ? { recipe_id: null, free_text: t } : null)
  }
  async function clear(date: string) {
    setOpen(null)
    await setWeekDay(date, null)
  }

  async function toList() {
    if (!pending.length || busy) return
    setBusy(true)
    try {
      await addItems(pending)
      await markAddedToList(week.filter((w) => w.recipe_id && !w.added_to_list).map((w) => w.date))
      setJustAdded(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <MilaPage>
      <header className="m-wk">
        <button type="button" className="m-wk__arrow" aria-label="Vorige Woche" onClick={() => turn(-7)}>‹</button>
        <div className="m-wk__mid">
          <span className="m-title">Was es geben könnte</span>
          <span className="m-sub">KW {isoWeek(monday)} · {weekRange(monday)}</span>
        </div>
        <button type="button" className="m-wk__arrow" aria-label="Nächste Woche" onClick={() => turn(7)}>›</button>
      </header>

      <div className="m-days">
        {dates.map((date, i) => {
          const day = byDate.get(date)
          const recipe = recipeById(day?.recipe_id)
          const dish = recipe?.name ?? day?.free_text ?? null
          const r = RHYTHM[i]
          const isOpen = open === date
          return (
            <div key={date} className={'m-day' + (isOpen ? ' m-day--open' : '')}>
              <button type="button" className="m-day__row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : date)}>
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
                  {day?.added_to_list && recipe && <span className="m-day__onlist" title="Zutaten stehen auf der Liste">✓ Liste</span>}
                </span>
              </button>
              {isOpen && (
                <DayPanel
                  date={date}
                  index={i}
                  day={day}
                  recipe={recipe}
                  recipes={recipes}
                  planned={planned}
                  onPick={(rec) => choose(date, rec)}
                  onAll={() => setPickFor(date)}
                  onFree={(t) => free(date, t)}
                  onClear={() => clear(date)}
                />
              )}
            </div>
          )
        })}
      </div>

      {(pending.length > 0 || onList > 0) && <div className="m-week-pad" aria-hidden />}
      {(pending.length > 0 || onList > 0) && (
        <div className="m-weekbar">
          {pending.length > 0 ? (
            <button type="button" className="m-bar__main" disabled={busy} onClick={toList}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              Zutaten auf die Liste
              <span className="m-weekbar__count">{pending.length}</span>
            </button>
          ) : (
            <Link to="/mila/liste" className={'m-weekbar__done' + (justAdded ? ' m-weekbar__done--pop' : '')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {onList} {onList === 1 ? 'Zutat' : 'Zutaten'} auf der Liste · ansehen ›
            </Link>
          )}
        </div>
      )}

      {pickFor && (
        <AllDishes
          recipes={recipes}
          current={byDate.get(pickFor)?.recipe_id ?? null}
          title={`${weekdayShort(pickFor)} ${fromISO(pickFor).getDate()}.${fromISO(pickFor).getMonth() + 1}.`}
          onPick={(rec) => choose(pickFor, rec)}
          onClose={() => setPickFor(null)}
        />
      )}
    </MilaPage>
  )
}

/** Aufgeklappter Tag: Vorschläge, alle Gerichte, Freitext, Rezept ansehen, leeren */
function DayPanel({
  date, index, day, recipe, recipes, planned, onPick, onAll, onFree, onClear,
}: {
  date: string
  index: number
  day: MilaWeekDay | undefined
  recipe: MilaRecipe | null
  recipes: MilaRecipe[]
  planned: Set<string>
  onPick: (r: MilaRecipe) => void
  onAll: () => void
  onFree: (text: string) => void
  onClear: () => void
}) {
  const [freeOpen, setFreeOpen] = useState(!!day?.free_text)
  const [text, setText] = useState(day?.free_text ?? '')
  const alts = useMemo(() => suggestions(date, index, recipes, planned, recipe?.id ?? null), [date, index, recipes, planned, recipe])

  function submit(e: FormEvent) {
    e.preventDefault()
    onFree(text)
  }

  return (
    <div className="m-day__panel">
      {alts.length > 0 && (
        <>
          <span className="m-day__label">{recipe || day?.free_text ? 'Tauschen gegen' : 'Vorschlag'}</span>
          <div className="m-alts">
            {alts.map((a) => (
              <button key={a.id} type="button" className="m-alt" onClick={() => onPick(a)}>
                {a.name}
                {a.time_min ? <span className="m-alt__time">{minutes(a.time_min)}</span> : null}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="m-day__actions">
        <button type="button" className="m-day__link" onClick={onAll}>Alle Gerichte ›</button>
        {!freeOpen && <button type="button" className="m-day__link" onClick={() => setFreeOpen(true)}>Freitext</button>}
        {recipe && <Link to={`/mila/gerichte/${recipe.id}`} className="m-day__link m-day__link--gold">Rezept ansehen ›</Link>}
        {(recipe || day?.free_text) && <button type="button" className="m-day__link m-day__link--quiet" onClick={onClear}>Tag leeren</button>}
      </div>
      {freeOpen && (
        <form className="m-free" onSubmit={submit}>
          <input
            type="text"
            className="m-input m-input--hand"
            placeholder="z. B. Rigatoni mit Bolognese aus Prep"
            aria-label="Freitext für diesen Tag"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            enterKeyHint="done"
            autoComplete="off"
          />
          <button type="submit" className="m-free__ok" aria-label="Übernehmen">✓</button>
        </form>
      )}
      {freeOpen && <span className="m-hint" style={{ fontSize: 12 }}>Freitext-Tage kommen nicht auf die Einkaufsliste.</span>}
    </div>
  )
}

/** 2–3 Vorschläge aus dem Fundus, passend zur Kategorie des Rhythmus; je Tag stabil gemischt */
function suggestions(date: string, index: number, recipes: MilaRecipe[], planned: Set<string>, currentId: string | null): MilaRecipe[] {
  const cat = RHYTHM[index].category
  if (!cat) return []
  let pool = recipes.filter((r) => r.category === cat)
  if (cat === 'grill' && pool.length < 3) pool = [...pool, ...recipes.filter((r) => r.category === 'wochenende')]
  pool = pool.filter((r) => r.id !== currentId && !planned.has(r.id))
  return pool
    .map((r) => ({ r, k: hashCode(date + r.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3)
    .map((x) => x.r)
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
