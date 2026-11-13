// Mila · Rezeptkarte: Vorderseite (Foto, Werte, Notizen) und Rückseite (Zutaten, Schritte), per Tipp umdrehen.
// Eine Komponente für alle Stellen (Fundus, Woche, Heute, Wisch-Karte), eigene Adresse #/mila/rezept/:id.
// Mit ?tag=YYYY-MM-DD&m=abend kommt sie von einem Tag der Woche: Portionen und Variante gelten dann für diesen Eintrag.
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMila } from './MilaContext'
import { isThermomix, minutes } from './rhythm'
import { CATEGORY_LABELS, tileKind } from './portions'
import { TileIcon } from './icons'
import { DIFFICULTY, PORTION_CHOICES, cardIngredients, dotColor, half, kicker, lastCookedLabel, lastPortions, mealPill, pantryLine, rememberPortions, stats, variantOf, isAddition } from './recipe-view'
import { Sheet } from '../components/ui'
import { addDays, fromISO, startOfWeek, today as todayISO, weekdayShort } from '../lib/dates'
import type { MealSlot, MilaBlend, MilaRecipe, MilaStep, MilaVariantKey, MilaWeekDay } from '../lib/types'

const VARIANT_LABEL: Record<MilaVariantKey, string> = { original: 'Original', light: 'Light', protein: 'Protein' }
const dm = (d: string) => `${fromISO(d).getDate()}.${fromISO(d).getMonth() + 1}.`

export function Rezeptkarte() {
  const { id } = useParams()
  const { ready, recipeById } = useMila()
  const recipe = recipeById(id)
  if (!ready) return <div className="rk rk--empty"><span className="hint">Einen Moment …</span></div>
  if (!recipe) return <Missing />
  return <Card key={recipe.id} recipe={recipe} />
}

function Missing() {
  const nav = useNavigate()
  return (
    <div className="rk rk--empty">
      <p className="m-hint">Dieses Gericht gibt es nicht mehr.</p>
      <button type="button" className="rk-btn rk-btn--ghost" onClick={() => nav('/mila/gerichte')}>Zum Fundus</button>
    </div>
  )
}

function useBack(): { label: string; go: () => void } {
  const nav = useNavigate()
  const loc = useLocation()
  const fromFundus = (loc.state as { from?: string } | null)?.from === 'fundus'
  return {
    label: fromFundus ? '‹ Fundus' : '‹ zurück',
    go: () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : nav('/mila/gerichte')),
  }
}

function Card({ recipe }: { recipe: MilaRecipe }) {
  const mila = useMila()
  const { ingredientsOf, stepsOf, hasThermomixSteps, weekDays, photoUrl, blends, setMeal, removeMeal, updateMeal, wahl } = mila
  const nav = useNavigate()
  const back = useBack()
  const [params] = useSearchParams()
  const today = todayISO()

  // Kommt die Karte von einem Tag der Woche?
  const dayDate = params.get('tag')
  const dayMeal = (params.get('m') as MealSlot | null) ?? 'abend'
  const fromDay = dayDate ? (weekDays.find((w) => w.date === dayDate && w.meal === dayMeal && w.recipe_id === recipe.id) ?? null) : null
  // Sonst: der nächste geplante Tag mit diesem Gericht
  const upcoming: MilaWeekDay | null =
    fromDay ?? [...weekDays].filter((w) => w.recipe_id === recipe.id && !w.is_leftover && w.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

  const [flipped, setFlipped] = useState(params.get('seite') === 'hinten')
  const [portions, setPortions] = useState(() => (fromDay?.servings && PORTION_CHOICES.includes(fromDay.servings) ? fromDay.servings : lastPortions()))
  const [variant, setVariant] = useState<MilaVariantKey>(() => fromDay?.variant ?? 'original')
  const tmAvailable = hasThermomixSteps(recipe.id)
  const [stepMode, setStepMode] = useState<'original' | 'thermomix'>('original')
  const [blend, setBlend] = useState<{ blend: MilaBlend; amount: string } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [pickDay, setPickDay] = useState<null | { move?: MilaWeekDay }>(null)
  const [entrySheet, setEntrySheet] = useState(false)

  const ings = ingredientsOf(recipe.id)
  const list = useMemo(() => cardIngredients(recipe, ings, portions, variant), [recipe, ings, portions, variant])
  const pantry = pantryLine(recipe, ings, portions)
  const steps = stepsOf(recipe.id, stepMode)
  const v = variantOf(recipe, variant)
  const st = stats(recipe, variant)
  const hasVariants = !!recipe.variants

  function choosePortions(n: number) {
    setPortions(n)
    rememberPortions(n)
    if (fromDay) void updateMeal(fromDay.id, { servings: n })
  }
  function chooseVariant(k: MilaVariantKey) {
    setVariant(k)
    if (fromDay) void updateMeal(fromDay.id, { variant: k })
  }
  function onCardTap(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button, a, input, label, [data-noflip]')) return
    setFlipped((f) => !f)
  }
  function cookHref(entry: MilaWeekDay | null) {
    // Reste für den nächsten Mittag gleich mitkochen
    const left = entry ? weekDays.find((x) => x.is_leftover && x.recipe_id === recipe.id && x.date === addDays(entry.date, 1)) : null
    const p = (entry?.servings ?? portions) + (left?.servings ?? 0)
    const vv = entry?.variant ?? variant
    return `/mila/kochen/${recipe.id}?p=${p}${vv !== 'original' ? `&v=${vv}` : ''}${stepMode === 'thermomix' ? '&s=tm' : ''}`
  }
  async function place(date: string, meal: MealSlot) {
    const move = pickDay?.move
    setPickDay(null)
    if (move) await removeMeal(move.date, move.meal)
    await setMeal(date, meal, recipe.id, portions, variant)
  }

  const photoSrc = photoUrl(recipe.photo_path)
  const kind = tileKind(recipe)
  const chips = [
    ...(recipe.tags?.length ? recipe.tags.slice(0, 3) : [CATEGORY_LABELS[recipe.category]]),
    ...(recipe.cook_double ? ['doppelt → Mittag'] : []),
    ...(isThermomix(recipe.devices) ? ['Thermomix'] : []),
  ]
  const prep = recipe.prep_info
  const notes: [string, string][] = []
  if (prep?.satz) notes.push(['Prep', prep.satz.replace(/\.$/, '') + (prep.haltbar_tage ? `, hält ${prep.haltbar_tage} ${prep.haltbar_tage === 1 ? 'Tag' : 'Tage'}` : '')])
  else if (recipe.prep_box) notes.push(['Prep', 'lässt sich komplett vorbereiten'])
  if (recipe.valerie_note) notes.push(['Valerie', recipe.valerie_note])
  if (recipe.anna?.hinweis) notes.push(['Anna', recipe.anna.hinweis])
  const tips = [recipe.device_tips?.thermomix ? `TM6: ${recipe.device_tips.thermomix}` : null, recipe.device_tips?.airfryer ? `Airfryer: ${recipe.device_tips.airfryer}` : null].filter(Boolean) as string[]
  const swapLines = v ? v.tausch.map((t) => (isAddition(t.statt) ? `dazu: ${t.nimm}` : `statt ${t.statt} → ${t.nimm}`)) : []
  const cardEntry = upcoming
  // Läuft eine übernommene Kombo, kommt das Gericht dorthin (Mila ordnet es nach Frist ein) statt auf einen Tag
  const kombo = !fromDay && wahl.currentPlan?.adopted_at ? wahl.currentPlan : null
  const inKombo = kombo ? wahl.itemsOf(kombo.id).some((i) => i.recipe_id === recipe.id && i.status === 'offen') : false

  return (
    <div className={'rk' + (flipped ? ' rk--back' : '')}>
      <header className="rk-head">
        <button type="button" className="rk-head__back" onClick={back.go}>{back.label}</button>
        <span className="rk-head__label">Mila · Rezeptkarte</span>
      </header>

      <div className="rk-stage">
        <div className="rk-flipper" onClick={onCardTap}>
          {/* ---------- Vorderseite ---------- */}
          <section className="rk-face rk-front" aria-label="Vorderseite" aria-hidden={flipped}>
            <span className="rk-tape" aria-hidden />
            <div className={'rk-photo' + (photoSrc ? ' rk-photo--img' : '')}>
              {photoSrc ? (
                <img src={photoSrc} alt={recipe.name} />
              ) : (
                <span className={'rk-photo__ph m-tile__pic--' + kind}>
                  <TileIcon kind={kind} size={64} />
                </span>
              )}
              <span className="rk-pill rk-pill--meal">{mealPill(recipe)}</span>
              {(prep?.tauglich || (!prep && recipe.prep_box)) && <span className="rk-pill rk-pill--prep">Prep-tauglich</span>}
              {photoSrc && <span className="rk-photo__src">Foto aus dem Rezept</span>}
            </div>
            <div className="rk-front__body">
              <span className="rk-caps">{kicker(recipe)}</span>
              <h1 className="rk-title">{recipe.name}</h1>
              {recipe.subtitle && <span className="rk-sub">{recipe.subtitle}</span>}
              <div className="rk-stats">
                <Stat icon="zeit" value={recipe.time_min ? minutes(recipe.time_min) : '–'} label="Zeit" />
                <Stat icon="kcal" value={st.kcal} label="kcal" />
                <Stat icon="protein" value={st.protein} label="Protein" />
                <Stat icon="aufwand" value={recipe.difficulty ? DIFFICULTY[recipe.difficulty] : '–'} label="Aufwand" />
              </div>
              <div className="rk-chips">
                {chips.map((c) => (
                  <span key={c} className="rk-chip">{c}</span>
                ))}
              </div>
              {notes.length > 0 && (
                <div className="rk-notes">
                  {notes.map(([k, t]) => (
                    <span key={k}>
                      <b>{k}:</b> {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="rk-grow" />
              <div className="rk-foot">
                <span>{lastCookedLabel(recipe.id, weekDays, today)}</span>
                <span className="rk-foot__tap">Tippen zum Umdrehen</span>
              </div>
            </div>
          </section>

          {/* ---------- Rückseite ---------- */}
          <section className="rk-face rk-back" aria-label="Rückseite" aria-hidden={!flipped}>
            <div className="rk-back__scroll">
              <div className="rk-row">
                <h2 className="rk-title rk-title--back">{recipe.name}</h2>
                {!recipe.hf_id && (
                  <button type="button" className="rk-link" onClick={() => nav(`/mila/gerichte/${recipe.id}/bearbeiten`)}>Bearbeiten</button>
                )}
              </div>

              {hasVariants && (
                <div className="rk-seg" role="radiogroup" aria-label="Variante">
                  {(['original', 'light', 'protein'] as MilaVariantKey[]).map((k) => {
                    const vv = variantOf(recipe, k)
                    const missing = k !== 'original' && !vv
                    const label =
                      k === 'original' ? 'Original' : missing ? (k === 'light' ? 'schon light' : 'schon proteinreich') : k === 'light' ? `Light ≈${vv?.kcal_geschaetzt ?? ''}` : `Protein ≈${Math.round(vv?.protein_g_geschaetzt ?? 0)} g`
                    return (
                      <button key={k} type="button" role="radio" aria-checked={variant === k} disabled={missing} className={'rk-seg__btn' + (variant === k ? ' rk-seg__btn--on' : '')} onClick={() => chooseVariant(k)}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="rk-row rk-row--ing">
                <span className="rk-caps rk-grow">Zutaten</span>
                <PersonIcon />
                {PORTION_CHOICES.map((n) => (
                  <button key={n} type="button" aria-label={`${n} Portionen`} aria-pressed={portions === n} className={'rk-por' + (portions === n ? ' rk-por--on' : '')} onClick={() => choosePortions(n)}>
                    {n}
                  </button>
                ))}
              </div>

              <div className="rk-ings">
                {list.map((i) => {
                  const [fill, ring] = dotColor(i.name, i.ing?.shop_category)
                  const bl = i.ing?.blend_key ? blends.find((b) => b.key === i.ing!.blend_key) : null
                  return (
                    <div key={i.key} className="rk-ing">
                      <span className={'rk-dot' + (i.swapped ? ' rk-dot--swap' : '')} style={{ background: fill, boxShadow: `inset 0 0 0 1.5px ${ring}` }} aria-hidden />
                      <span className="rk-ing__text">
                        {bl ? (
                          <button type="button" className="rk-ing__name rk-ing__name--mix" onClick={() => setBlend({ blend: bl, amount: i.amount })}>{i.name}</button>
                        ) : (
                          <span className="rk-ing__name">
                            {i.name}
                            {i.ing?.hint && (
                              <button type="button" className="rk-info" aria-label="Hinweis" aria-expanded={hint === i.key} onClick={() => setHint(hint === i.key ? null : i.key)}>ⓘ</button>
                            )}
                          </span>
                        )}
                        <span className="rk-ing__amt">
                          {i.amount}
                          {i.optional && <span className="rk-ing__note">{i.amount ? ' · ' : ''}optional</span>}
                          {i.note && <span className={'rk-ing__note' + (i.swapped ? ' rk-ing__note--gold' : '')}>{i.amount || i.optional ? ' · ' : ''}{i.note}</span>}
                        </span>
                        {hint === i.key && i.ing?.hint && <span className="rk-ing__hint">{i.ing.hint}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>

              {v && (
                <div className="rk-swap">
                  <span className="rk-swap__title">{VARIANT_LABEL[variant]} · {st.kcal.replace('≈', '≈ ')} kcal · {st.protein.replace('≈', '≈ ')} Protein</span>
                  {swapLines.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                  <span className="rk-swap__note">Werte geschätzt</span>
                </div>
              )}
              {pantry && <span className="rk-pantry">Hast du da: {pantry}</span>}

              <div className="rk-dash" />
              <div className="rk-row">
                <span className="rk-caps rk-grow">So geht’s</span>
                {tmAvailable && (
                  <div className="rk-seg rk-seg--small" role="radiogroup" aria-label="Schritte">
                    {(['original', 'thermomix'] as const).map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={stepMode === k} className={'rk-seg__btn' + (stepMode === k ? ' rk-seg__btn--on' : '')} onClick={() => setStepMode(k)}>
                        {k === 'original' ? 'Original' : 'Thermomix'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {tips.length > 0 && stepMode === 'original' && <span className="rk-tips">{tips.join(' · ')}</span>}
              {stepMode === 'thermomix' && <span className="rk-tips">TM6-Version · Vorschlag, noch nicht getestet</span>}
              {stepMode === 'original' && portions !== recipe.portions && <span className="rk-pornote">Mengen im Text für {recipe.portions} Portionen, die Zutatenliste ist umgerechnet</span>}

              <ol className="rk-steps">
                {steps.map((s, k) => (
                  <Step key={s.id} s={s} n={k + 1} photo={photoUrl(s.photo_path)} onPhoto={setPhoto} />
                ))}
              </ol>
              {steps.length === 0 && <p className="m-hint">Noch keine Schritte eingetragen.</p>}

              {(recipe.allergens?.length || recipe.traces?.length) ? (
                <div className="rk-allerg">
                  {recipe.allergens?.length ? <span>Allergene: {recipe.allergens.join(' · ')}</span> : null}
                  {recipe.traces?.length ? <span className="rk-allerg__traces">Spuren: {recipe.traces.join(' · ')}</span> : null}
                </div>
              ) : null}
              <button type="button" className="rk-link rk-link--cook" onClick={() => nav(cookHref(fromDay))}>Kochmodus starten ›</button>
            </div>
          </section>
        </div>
      </div>

      <div className="rk-bar">
        <button type="button" className="rk-btn rk-btn--ghost" onClick={() => setFlipped((f) => !f)}>
          <FlipIcon />
          {flipped ? 'Vorderseite' : 'Umdrehen'}
        </button>
        {kombo ? (
          inKombo ? (
            <button type="button" className="rk-btn rk-btn--wide rk-btn--done" onClick={() => nav('/mila/wahl')}>✓ in der Kombo</button>
          ) : (
            <button type="button" className="rk-btn rk-btn--wide rk-btn--main" onClick={() => void wahl.addToKombo(kombo, recipe.id, recipe.meal === 'mittag' ? 'mittag' : 'abend', portions, variant)}>Auf die Wochenkarte</button>
          )
        ) : cardEntry ? (
          <button type="button" className="rk-btn rk-btn--wide rk-btn--done" onClick={() => setEntrySheet(true)}>
            ✓ auf der Wochenkarte · {weekdayShort(cardEntry.date)}
          </button>
        ) : (
          <button type="button" className="rk-btn rk-btn--wide rk-btn--main" onClick={() => setPickDay({})}>Auf die Wochenkarte</button>
        )}
      </div>

      {entrySheet && cardEntry && (
        <Sheet onClose={() => setEntrySheet(false)} title="Auf der Wochenkarte">
          <div className="stack" style={{ gap: 12 }}>
            <span className="m-sub">{weekdayShort(cardEntry.date)} {dm(cardEntry.date)} · {cardEntry.meal === 'abend' ? 'Abend' : 'Mittag'}{cardEntry.servings ? ` · ${cardEntry.servings} Portionen` : ''}{cardEntry.variant && cardEntry.variant !== 'original' ? ` · ${VARIANT_LABEL[cardEntry.variant]}` : ''}</span>
            <button type="button" className="m-bar__main" onClick={() => nav(cookHref(cardEntry))}>Kochen</button>
            <div className="m-day__actions">
              <button type="button" className="m-day__link m-day__link--gold" onClick={() => { setEntrySheet(false); setPickDay({ move: cardEntry }) }}>Anderer Tag</button>
              <button type="button" className="m-day__link m-day__link--quiet" onClick={() => { setEntrySheet(false); void removeMeal(cardEntry.date, cardEntry.meal) }}>Entfernen</button>
            </div>
          </div>
        </Sheet>
      )}

      {pickDay && <DayPicker recipe={recipe} portions={portions} onPick={place} onClose={() => setPickDay(null)} />}

      {blend && (
        <Sheet onClose={() => setBlend(null)} title={blend.blend.name}>
          <BlendSheet blend={blend.blend} amount={blend.amount} recipe={recipe} onClose={() => setBlend(null)} />
        </Sheet>
      )}

      {photo && (
        <button type="button" className="rk-lightbox" onClick={() => setPhoto(null)} aria-label="Foto schließen">
          <img src={photo} alt="" />
        </button>
      )}
    </div>
  )
}

function Step({ s, n, photo, onPhoto }: { s: MilaStep; n: number; photo: string | null; onPhoto: (u: string) => void }) {
  const tm = s.is_thermomix
  return (
    <li className="rk-step">
      <span className="rk-step__n">{n}</span>
      <div className="rk-step__body">
        <div className="rk-step__head">
          {s.title && <span className="rk-step__title">{s.title}</span>}
          {s.in_prep && <span className="rk-step__prep">im Prep</span>}
        </div>
        {tm && (
          <div className="rk-tm">
            <Tile label="Zeit" value={tmTime(s.tm_time_sec)} />
            <Tile label="Temp." value={s.tm_temp ? (/^\d+$/.test(s.tm_temp) ? `${s.tm_temp} °C` : s.tm_temp) : '–'} />
            <Tile label="Stufe" value={(s.tm_speed ?? '–') + (s.tm_reverse ? ' ↺' : '')} />
          </div>
        )}
        <span className="rk-step__text">{s.text}</span>
      </div>
      {photo && (
        <button type="button" className="rk-step__photo" onClick={() => onPhoto(photo)} aria-label="Schrittfoto vergrößern">
          <img src={photo} alt="" loading="lazy" />
        </button>
      )}
    </li>
  )
}

function tmTime(sec: number | null): string {
  if (!sec) return '–'
  if (sec < 60) return `${sec} Sek`
  const m = Math.round(sec / 60)
  return `${m} Min`
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <span className="rk-tile">
      <span className="rk-tile__l">{label}</span>
      <span className="rk-tile__v">{value}</span>
    </span>
  )
}

function BlendSheet({ blend, amount, recipe, onClose }: { blend: MilaBlend; amount: string; recipe: MilaRecipe; onClose: () => void }) {
  return (
    <div className="stack rk-blend" style={{ gap: 9 }}>
      <div className="rk-row">
        <span className="rk-title rk-title--blend rk-grow">{blend.name}</span>
        {blend.geschaetzt && <span className="rk-step__prep">geschätzt</span>}
      </div>
      <span className="rk-blend__sub">
        {blend.ersetzt ? `ersetzt ${blend.ersetzt}` : ''}
        {amount ? `${blend.ersetzt ? ' · ' : ''}in diesem Gericht: ${amount}` : ''}
      </span>
      <span className="rk-caps">Fürs Glas</span>
      <div className="stack" style={{ gap: 5 }}>
        {blend.glas_rezept.map((m) => (
          <div key={m.zutat} className="rk-blend__row">
            <span>{m.zutat}</span>
            <span>{m.menge != null ? `${half(m.menge)} ${m.einheit ?? ''}` : (m.einheit ?? '')}</span>
          </div>
        ))}
      </div>
      {blend.portion && <span className="rk-blend__sub">{blend.portion}</span>}
      {blend.scharf && recipe.valerie_note && (
        <span className="rk-blend__line">
          <b>Valerie:</b> leicht scharf, ihre Portion vor dem Würzen abnehmen
        </span>
      )}
      {blend.haltbar && <span className="rk-blend__sub">Hält {blend.haltbar}</span>}
      {blend.hinweis && <span className="rk-blend__sub">{blend.hinweis}</span>}
      <button type="button" className="m-bar__main" onClick={onClose}>Fertig</button>
    </div>
  )
}

/** Tagesauswahl: Abend oder Mittag, die nächsten zwei Wochen */
function DayPicker({ recipe, portions, onPick, onClose }: { recipe: MilaRecipe; portions: number; onPick: (date: string, meal: MealSlot) => void; onClose: () => void }) {
  const { weekDays, recipeById } = useMila()
  const [meal, setMeal] = useState<MealSlot>(recipe.meal === 'mittag' ? 'mittag' : 'abend')
  const start = todayISO()
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfWeek(start), i)).filter((d) => d >= start)
  useEffect(() => setMeal(recipe.meal === 'mittag' ? 'mittag' : 'abend'), [recipe.meal])
  return (
    <Sheet onClose={onClose} title="Tag wählen">
      <div className="stack" style={{ gap: 4 }}>
        <span className="m-group__label">{recipe.name} · {portions} Portionen · an welchem Tag?</span>
        <div className="m-chips" role="radiogroup">
          {(['abend', 'mittag'] as MealSlot[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={meal === m} className={'m-chip m-chip--small' + (meal === m ? ' m-chip--on' : '')} onClick={() => setMeal(m)}>{m === 'abend' ? 'Abend' : 'Mittag'}</button>
          ))}
        </div>
        {days.map((d) => {
          const cur = recipeById(weekDays.find((w) => w.date === d && w.meal === meal)?.recipe_id)
          return (
            <button key={d} type="button" className="m-dayopt" onClick={() => onPick(d, meal)}>
              <span className="m-day__when">
                <span className="m-day__wd">{weekdayShort(d)}</span>
                <span className="m-day__date">{dm(d)}</span>
              </span>
              {cur ? <span className="m-dayopt__current">{cur.name}</span> : <span className="m-dayopt__free">frei</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function Stat({ icon, value, label }: { icon: 'zeit' | 'kcal' | 'protein' | 'aufwand'; value: string; label: string }) {
  const paths: Record<typeof icon, ReactNode> = {
    zeit: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    kcal: <path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 2 0-3-1-5 0-7z" />,
    protein: <path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" />,
    aufwand: <path d="M6 18v-4M12 18v-8M18 18V6" />,
  }
  return (
    <div className="rk-stat">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {paths[icon]}
      </svg>
      <span className="rk-stat__v">{value}</span>
      <span className="rk-stat__l">{label}</span>
    </div>
  )
}

function PersonIcon() {
  return (
    <svg className="rk-person" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" role="img" aria-label="Personen">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </svg>
  )
}

function FlipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />
    </svg>
  )
}
