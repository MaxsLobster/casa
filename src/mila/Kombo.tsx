// Mila · Eure Kombo: keine Wochentage, sondern eine Kochreihenfolge in drei Gruppen (zuerst · aus dem Prep · zum Schluss).
// Darunter Prep-Stunde und Reserve. „Gericht tauschen“ und „Kombo übernehmen“ (Einkaufszettel + Prep-Plan).
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMila } from './MilaContext'
import { MilaBand, Initial } from './Band'
import { weekLabel } from './Wochenwahl'
import { mealCount, prepMinutes } from './wahl'
import { shortName } from './engine'
import { Sheet } from '../components/ui'
import { today as todayISO, weekdayShort } from '../lib/dates'
import type { MilaItemGroup, MilaPlanItem, MilaWeekPlan } from '../lib/types'

export const GROUPS: { id: MilaItemGroup; title: string; sub: string }[] = [
  { id: 'zuerst', title: 'Zuerst', sub: 'Tag 1–2 · empfindlich' },
  { id: 'prep', title: 'Aus dem Prep', sub: 'Tag 2–4 · im Prep haltbar gemacht' },
  { id: 'schluss', title: 'Zum Schluss', sub: 'Tag 4–6 · robust' },
]
const BADGE: Record<string, string> = { joker: '★', treffer: '✓✓', halb: '✓', offen: '?', dazu: '+' }

export function itemNote(i: MilaPlanItem, gekochtLabel = true): string {
  if (i.status === 'gekocht' && gekochtLabel) return `gekocht ${i.gekocht_am ? weekdayShort(i.gekocht_am) : ''}`.trim()
  if (i.status === 'eingefroren') return 'eingefroren · kommt nächste Woche wieder'
  if (i.slot === 'reste') return 'am Tag danach'
  const today = todayISO()
  const bis = !i.frist_bis ? 'Vorrat, hält lange' : i.frist_bis < today ? 'Frist vorbei, lieber einfrieren' : i.frist_bis === today ? 'muss heute weg' : `hält bis ${weekdayShort(i.frist_bis)}`
  return [i.gruppe === 'prep' ? 'im Prep' : i.gruppe === 'zuerst' ? 'frisch' : 'robust', bis, i.art === 'offen' ? 'Vorschlag von Mila' : null].filter(Boolean).join(' · ')
}

export function Kombo({ plan }: { plan: MilaWeekPlan }) {
  const { wahl, me, partner, recipeById, stepsOf, prepStepsOf } = useMila()
  const nav = useNavigate()
  const [swap, setSwap] = useState<null | { item?: MilaPlanItem }>(null)
  const [busy, setBusy] = useState(false)
  const all = wahl.itemsOf(plan.id)
  const live = all.filter((i) => i.status !== 'reserve' && i.status !== 'getauscht')
  const reserve = all.filter((i) => i.status === 'reserve')
  const count = mealCount(all)
  const arts = live.filter((i) => i.slot !== 'reste')
  const treffer = arts.filter((i) => i.art === 'treffer').length
  const joker = arts.filter((i) => i.art === 'joker').length
  const halb = arts.filter((i) => i.art === 'halb').length
  const offen = arts.filter((i) => i.art === 'offen').length
  const summary = [treffer ? `${treffer} Treffer` : null, joker ? `${joker} Joker` : null, halb ? `${halb} halbe` : null, offen ? `${offen} Vorschlag${offen === 1 ? '' : 'e'} von Mila` : null].filter(Boolean).join(' + ')
  const prepItems = live.filter((i) => i.gruppe === 'prep' && i.slot !== 'reste')
  const prepRecipes = prepItems.map((i) => recipeById(i.recipe_id)).filter(Boolean) as NonNullable<ReturnType<typeof recipeById>>[]
  const prepMin = useMemo(() => prepMinutes(prepRecipes, (id) => stepsOf(id), prepStepsOf), [prepRecipes, stepsOf, prepStepsOf])
  const adopted = !!plan.adopted_at

  async function adopt() {
    setBusy(true)
    await wahl.adoptPlan(plan)
    setBusy(false)
  }

  return (
    <div className="page mw">
      <MilaBand kicker={`${weekLabel(plan.week)} · ${plan.abend_anzahl} Abend + ${plan.mittag_anzahl} Mittag`} title="Eure Kombo" chip={adopted ? 'übernommen' : plan.beide_fertig_at ? 'beide fertig' : 'So 20:00'} />
      <div className="mw__pad mw__stack">
        <div className="mw__who">
          <div className="mw__pair">
            <Initial name={me.display_name} size={38} />
            {partner && <Initial name={partner.display_name} partner size={38} />}
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <span className="mw__hand mw__hand--30">{count.gerichte} Gerichte = {count.mahlzeiten} Mahlzeiten</span>
            <span className="m-hint" style={{ fontSize: 12 }}>{summary || 'noch nichts gewählt'} · sortiert nach Frische</span>
          </div>
        </div>

        {all.length === 0 && <p className="m-hint">Mila baut die Kombo gerade …</p>}

        {GROUPS.map((g) => {
          const list = live.filter((i) => i.gruppe === g.id)
          if (!list.length) return null
          return (
            <section key={g.id} className="mk__group">
              <div className="mk__head">
                <span className={'mk__dot mk__dot--' + g.id} aria-hidden />
                <span className="mk__title">{g.title}</span>
                <span className="mk__sub">{g.sub}</span>
              </div>
              <div className="mk__list">
                {list.map((i) => {
                  const r = recipeById(i.recipe_id)
                  if (!r) return null
                  return (
                    <button key={i.id} type="button" className={'mk__row' + (i.status === 'gekocht' || i.status === 'eingefroren' ? ' mk__row--done' : '')} onClick={() => nav(`/mila/rezept/${r.id}`)}>
                      <span className={'mk__badge mk__badge--' + (i.slot === 'reste' ? 'reste' : i.art)}>{i.slot === 'reste' ? '↺' : BADGE[i.art]}</span>
                      <span className="mk__text">
                        <span className="mk__dish">{i.slot === 'reste' ? `${shortName(r.name)} – Reste` : r.name}</span>
                        <span className="mk__note">{itemNote(i)}</span>
                      </span>
                      <span className={'mk__meal' + (i.slot === 'abend' ? '' : ' mk__meal--mittag')}>{i.slot === 'abend' ? 'Abend' : 'Mittag'}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        {(prepItems.length > 0 || reserve.length > 0) && (
          <div className="mw__note">
            {prepItems.length > 0 && (
              <span>
                <b>Prep-Stunde:</b> {prepRecipes.map((r) => shortName(r.name)).join(', ')} · ca. {prepMin} Min
              </span>
            )}
            {reserve.length > 0 && (
              <span>
                <b>Reserve:</b> {reserve.map((i) => `${shortName(recipeById(i.recipe_id)?.name ?? '')} (${i.art === 'halb' ? 'halber Treffer' : i.art === 'joker' ? 'Joker' : 'Treffer'})`).join(' · ')}
              </span>
            )}
          </div>
        )}

        {all.length > 0 && (
          <div className="mk__buttons">
            <button type="button" className="rk-btn rk-btn--ghost" onClick={() => setSwap({})}>Gericht tauschen</button>
            {adopted ? (
              <Link to="/mila/einkauf" className="rk-btn rk-btn--wide rk-btn--done" style={{ textDecoration: 'none' }}>✓ übernommen · Zettel</Link>
            ) : (
              <button type="button" className="rk-btn rk-btn--wide rk-btn--main" disabled={busy} onClick={adopt}>Kombo übernehmen</button>
            )}
          </div>
        )}
        <span className="mw__fine">Haltbarkeiten pro Zutat geschätzt · keine festen Tage – Mila sagt jeden Tag, was dran ist.</span>
      </div>

      {swap && <SwapSheet plan={plan} item={swap.item} onPick={(item) => setSwap({ item })} onClose={() => setSwap(null)} />}
    </div>
  )
}

function SwapSheet({ plan, item, onPick, onClose }: { plan: MilaWeekPlan; item?: MilaPlanItem; onPick: (i: MilaPlanItem) => void; onClose: () => void }) {
  const { wahl, recipes, recipeById } = useMila()
  const [q, setQ] = useState('')
  const all = wahl.itemsOf(plan.id)
  const live = all.filter((i) => i.status === 'offen' && i.slot !== 'reste')
  const reserve = all.filter((i) => i.status === 'reserve')
  const inPlan = new Set(all.filter((i) => i.status !== 'getauscht').map((i) => i.recipe_id))
  const fits = (meal: string, m: string) => m === 'beides' || m === meal
  const fundus = item
    ? recipes
        .filter((r) => !inPlan.has(r.id) && fits(item.slot, r.meal) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .slice(0, 40)
    : []
  async function choose(recipeId: string) {
    if (!item) return
    onClose()
    await wahl.swapItem(item, recipeId)
  }
  return (
    <Sheet onClose={onClose} title="Gericht tauschen">
      <div className="stack" style={{ gap: 6 }}>
        {!item ? (
          <>
            <span className="m-group__label">Welches Gericht soll raus?</span>
            {live.map((i) => (
              <button key={i.id} type="button" className="m-dayopt" onClick={() => onPick(i)}>
                <span className="m-dayopt__current" style={{ flex: 1 }}>{recipeById(i.recipe_id)?.name}</span>
                <span className="m-day__time">{i.slot === 'abend' ? 'Abend' : 'Mittag'}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <span className="m-group__label">Statt {recipeById(item.recipe_id)?.name}:</span>
            {reserve.filter((r) => fits(item.slot, recipeById(r.recipe_id)?.meal ?? '')).map((r) => (
              <button key={r.id} type="button" className="m-dayopt" onClick={() => choose(r.recipe_id)}>
                <span className="m-dayopt__current" style={{ flex: 1 }}>{recipeById(r.recipe_id)?.name}</span>
                <span className="m-day__time">Reserve</span>
              </button>
            ))}
            <input type="search" className="m-input" placeholder="Im Fundus suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Im Fundus suchen" />
            {fundus.map((r) => (
              <button key={r.id} type="button" className="m-dayopt" onClick={() => choose(r.id)}>
                <span className="m-dayopt__current" style={{ flex: 1 }}>{r.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </Sheet>
  )
}
