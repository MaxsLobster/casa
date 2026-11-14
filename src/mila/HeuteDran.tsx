// Mila · Heute dran: Vorschlag fürs Abendessen (kürzeste Restfrist), dazu das Mittagessen, „lieber was anderes?“
// und die Kühlschrank-Ampel für Prep-Boxen und frische Zutaten. Haltbarkeit geschätzt.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMila } from './MilaContext'
import { MilaBand } from './Band'
import { itemNote } from './Kombo'
import { SwipeRemove, useUndo } from './SwipeRemove'
import { minutes } from './rhythm'
import { shortName } from './engine'
import { ampelOf, daysBetween, fridge, heuteDran, ingredientDays, spoilsToday } from './wahl'
import { addDays, fromISO, today as todayISO, weekdayLong, weekdayShort } from '../lib/dates'
import type { MilaPlanItem, MilaRecipe } from '../lib/types'

const MONTHS = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function HeuteDran() {
  const { ready, wahl, recipeById, ingredientsOf } = useMila()
  const nav = useNavigate()
  const [swap, setSwap] = useState(false)
  const undo = useUndo()
  if (!ready) return <div className="page"><span className="hint">Einen Moment …</span></div>
  const today = todayISO()
  const d = fromISO(today)
  const plan = wahl.currentPlan
  const kicker = `${weekdayShort(today)}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`

  if (!plan || plan.status === 'wischen' || !plan.adopted_at) {
    return (
      <div className="page mw">
        <MilaBand kicker={kicker} title="Heute dran" />
        <div className="mw__pad mw__stack">
          {plan && plan.status === 'kombo' ? (
            <>
              <p className="mw__lead">Eure Kombo für diese Woche steht, ist aber noch nicht übernommen.</p>
              <Link to="/mila/wahl" className="mw__main" style={{ textDecoration: 'none' }}>Zur Kombo</Link>
            </>
          ) : (
            <p className="mw__lead">Für diese Woche gibt es keine Kombo. Ab Freitag wählt ihr die nächste Woche.</p>
          )}
          <div className="mh__links">
            <Link to="/mila/woche" className="m-day__link">Woche ›</Link>
            <Link to="/mila/gerichte" className="m-day__link">Alle Gerichte ›</Link>
          </div>
        </div>
      </div>
    )
  }

  const items = wahl.itemsOf(plan.id)
  const h = heuteDran(items, today)
  const tag = daysBetween(plan.week, today) + 1
  const chip = `noch ${h.restAbend} ${h.restAbend === 1 ? 'Abend' : 'Abende'} · ${h.restMittag} Mittag`
  const entries = fridge({ plan, items, recipeById, ingredientsOf, rules: wahl.rules, today, weekdayShort })
  const abendR = h.abend ? recipeById(h.abend.recipe_id) : null
  const mittagR = h.mittag ? recipeById(h.mittag.recipe_id) : null
  const cookedToday = h.abend?.status === 'gekocht'
  const urgent = h.abend && !cookedToday && spoilsToday(h.abend, today) && abendR ? mustGo(abendR, ingredientsOf, wahl.rules) : null
  const alts = items.filter((i) => i.status === 'offen' && i.slot === 'abend' && i.id !== h.abend?.id).sort((a, b) => (a.frist_bis ?? '9999').localeCompare(b.frist_bis ?? '9999'))
  const willSpoil = !!h.abend && !cookedToday && spoilsToday(h.abend, today)

  async function cook(item: MilaPlanItem) {
    const reste = items.find((i) => i.parent_id === item.id)
    await wahl.cookItem(item)
    nav(`/mila/kochen/${item.recipe_id}?p=${item.portionen + (reste?.portionen ?? 0)}${item.variante !== 'original' ? `&v=${item.variante}` : ''}`)
  }

  return (
    <div className="page mw">
      <MilaBand kicker={`${kicker} · Tag ${tag}`} title="Heute dran" chip={chip} />
      <div className="mw__pad mw__stack">
        {!swap && h.abend && abendR && (
          <SwipeRemove onRemove={async () => undo.offer(shortName(abendR.name), await wahl.removeItem(h.abend!))}>
          <div className="mh__main">
            <span className="rk-tape" aria-hidden />
            <div className="mh__line">
              <span className="mk__meal">Abend</span>
              {urgent && (
                <span className="mh__urgent">
                  <span className="mh__dot mh__dot--rot" aria-hidden />
                  {urgent} muss heute weg
                </span>
              )}
              {cookedToday && <span className="mh__ok">heute gekocht ✓</span>}
            </div>
            <button type="button" className="mh__name" onClick={() => nav(`/mila/rezept/${abendR.id}`)}>{abendR.name}</button>
            <span className="mh__meta">{[minutes(abendR.time_min), itemNote(h.abend, false), abendR.device_tips?.airfryer ? 'Airfryer-Tipp auf der Karte' : null].filter(Boolean).join(' · ')}</span>
            {!cookedToday && (
              <>
                <div className="mh__buttons">
                  <button type="button" className="rk-btn rk-btn--ghost" onClick={() => nav(`/mila/rezept/${abendR.id}`)}>Rezeptkarte</button>
                  <button type="button" className="rk-btn rk-btn--main" onClick={() => cook(h.abend!)}>▶ Kochen</button>
                </div>
                <div className="mh__more">
                  <button type="button" className="mh__swap" onClick={() => setSwap(true)}>lieber was anderes?</button>
                  <button type="button" className="mh__eaten" onClick={() => void wahl.cookItem(h.abend!)}>gegessen ✓</button>
                </div>
              </>
            )}
          </div>
          </SwipeRemove>
        )}

        {swap && h.abend && abendR && (
          <div className="mh__main">
            <span className="mw__hand mw__hand--28">Was stattdessen?</span>
            {willSpoil && (
              <span className="mh__warn">
                {urgent ? `${urgent} hält nicht bis morgen` : 'Das hält nicht bis morgen'} – Mila legt es ins Gefrierfach und {shortName(abendR.name)} nächste Woche wieder auf den Stapel.
              </span>
            )}
            {alts.length === 0 && <span className="m-hint">Sonst ist nichts mehr offen.</span>}
            {alts.map((a) => {
              const r = recipeById(a.recipe_id)
              if (!r) return null
              const c = a.frist_bis ? ampelOf(a.frist_bis, today) : 'gruen'
              return (
                <div key={a.id} className="mh__alt">
                  <span className={'mh__dot mh__dot--' + c} aria-hidden />
                  <span className="mk__text">
                    <span className="mk__dish">{r.name}</span>
                    <span className="mk__note">{itemNote(a, false)}</span>
                  </span>
                  <button type="button" className="mh__take" onClick={() => { setSwap(false); void wahl.pickToday(a, willSpoil ? h.abend : null) }}>nehmen</button>
                </div>
              )
            })}
            <button type="button" className="mh__back" onClick={() => setSwap(false)}>doch {shortName(abendR.name)}</button>
          </div>
        )}

        {!h.abend && <p className="mw__lead">Alle Abendgerichte der Kombo sind gekocht. Schön!</p>}

        {h.mittag && mittagR && (
          <SwipeRemove onRemove={async () => undo.offer(shortName(mittagR.name), await wahl.removeItem(h.mittag!))}>
          <div className="mh__lunch">
            <span className="mk__meal mk__meal--mittag">Mittag</span>
            <button type="button" className="mk__text mh__lunchtext" onClick={() => nav(`/mila/rezept/${mittagR.id}`)}>
              <span className="mk__dish">{h.mittag.slot === 'reste' ? `Reste: ${mittagR.name}` : mittagR.name}</span>
              <span className="mk__note">{h.mittag.status === 'gekocht' ? 'heute gegessen ✓' : h.mittag.slot === 'reste' ? 'vom Vortag · aufwärmen' : 'fertig in der Box'}</span>
            </button>
            {h.mittag.status !== 'gekocht' && <button type="button" className="mh__take" onClick={() => void wahl.cookItem(h.mittag!)}>gegessen</button>}
          </div>
          </SwipeRemove>
        )}

        <span className="rk-caps" style={{ marginTop: 4 }}>Kühlschrank-Ampel</span>
        {entries.length ? (
          <div className="mk__list">
            {entries.map((e) => (
              <div key={e.key} className="mh__fridge">
                <span className={'mh__dot mh__dot--' + e.color} aria-hidden />
                <span className="mh__fname">{e.name}</span>
                <span className={'mh__when' + (e.color === 'rot' ? ' mh__when--rot' : '')}>{e.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-hint">{plan.einkauf_tag && today < plan.einkauf_tag ? `Ab dem Einkauf am ${weekdayLong(plan.einkauf_tag)} zeigt Mila hier, was zuerst weg muss.` : 'Nichts Frisches mehr offen.'}</p>
        )}
        <span className="mw__fine">
          Haltbarkeit geschätzt · rot = heute oder einfrieren · gelb = bald · grün = entspannt · <Link to="/mila/haltbarkeit" className="mh__rules">Regeln ›</Link>
        </span>
        {undo.bar()}
        <div className="mh__links">
          <Link to="/mila/kombo" className="m-day__link">Kombo der Woche ›</Link>
          <Link to="/mila/woche" className="m-day__link">Woche ›</Link>
          <Link to="/mila/gerichte" className="m-day__link">Alle Gerichte ›</Link>
        </div>
      </div>
    </div>
  )
}

/** Welche Zutat begrenzt das Gericht? „Hähnchen“, „Babyspinat“ … */
function mustGo(r: MilaRecipe, ingredientsOf: (id: string) => import('../lib/types').MilaIngredient[], rules: import('../lib/types').MilaShelfRule[]): string | null {
  let best: { name: string; d: number } | null = null
  for (const i of ingredientsOf(r.id)) {
    const d = ingredientDays(i, rules)
    if (d !== null && (!best || d < best.d)) best = { name: i.name, d }
  }
  return best?.name ?? null
}
void addDays
