// Mila · Wochenkarte: jeder wählt für sich, anonym. ✕ nein · ✓ ja · ★ unbedingt (1 Joker pro Karte).
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { cardLabel, cardBlurb, deadline, openMenu } from './menu-view'
import { lastEaten, lastLabel, menuTimes, cardWeek } from './engine'
import { minutes } from './rhythm'
import type { MealSlot, MilaMenu, MilaRecipe, MilaVoteKind } from '../lib/types'
import { addDays, startOfWeek, today } from '../lib/dates'
import { nowStamp } from './MilaContext'

const SWIPE = 90

export function Karte() {
  const mila = useMila()
  const { menus, rhythm } = mila
  const menu = openMenu(menus)
  if (!menu) {
    const next = cardWeek(nowStamp(), rhythm) ?? addDays(startOfWeek(today()), 7)
    const opens = menuTimes(next, rhythm).opens
    return (
      <MilaPage>
        <KarteHead kicker="Essen wählen" />
        <p className="m-hint">Die nächste Wochenkarte kommt {deadline(new Date(opens).toISOString())}. Dann wählt ihr beide, jeder für sich.</p>
        <Link to="/mila/woche" className="link" style={{ alignSelf: 'flex-start' }}>Zur Woche ›</Link>
      </MilaPage>
    )
  }
  if (menu.revealed_at) {
    return (
      <MilaPage>
        <KarteHead kicker="Essen wählen" />
        <p className="m-hint">Die Karte ist aufgedeckt.</p>
        <Link to="/mila/woche" className="m-bar__main" style={{ textDecoration: 'none' }}>Zu den Treffern ›</Link>
      </MilaPage>
    )
  }
  return <Voting menu={menu} />
}

function KarteHead({ kicker }: { kicker: string }) {
  return (
    <header className="m-head">
      <span className="m-sub">{kicker}</span>
      <span className="m-title">Wochenkarte</span>
    </header>
  )
}

function Voting({ menu }: { menu: MilaMenu }) {
  const { me, partner, votes, recipeById, weekDays, vote, resetVotes, setDone } = useMila()
  const cards: { meal: MealSlot; ids: string[]; label: string }[] = [
    { meal: 'abend' as MealSlot, ids: menu.dinner_ids, label: 'Abendkarte' },
    { meal: 'mittag' as MealSlot, ids: menu.lunch_ids, label: 'Mittagskarte' },
  ].filter((c) => c.ids.length > 0)
  const mine = votes.filter((v) => v.menu_id === menu.id && v.member_id === me.id)
  const voteOf = (id: string, meal: MealSlot) => mine.find((v) => v.recipe_id === id && v.meal === meal)?.vote
  const openOf = (c: (typeof cards)[number]) => c.ids.filter((id) => !voteOf(id, c.meal) && recipeById(id))
  const firstOpen = cards.find((c) => openOf(c).length > 0)?.meal ?? cards[0]?.meal ?? 'abend'
  const [meal, setMeal] = useState<MealSlot>(firstOpen)
  const card = cards.find((c) => c.meal === meal) ?? cards[0]
  const allDone = cards.every((c) => openOf(c).length === 0)
  const iAmDone = menu.done_by.includes(me.id)
  const partnerDone = !!partner && menu.done_by.includes(partner.id)

  // Nach dem letzten Gericht: fertig melden
  useEffect(() => {
    if (allDone && !iAmDone && cards.length) setDone(menu, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, iAmDone])

  // Karte fertig: zur anderen springen
  const pending = card ? openOf(card) : []
  useEffect(() => {
    if (pending.length === 0) {
      const other = cards.find((c) => c.meal !== meal && openOf(c).length > 0)
      if (other) setMeal(other.meal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length])

  if (!card) return <MilaPage><KarteHead kicker="Essen wählen" /><p className="m-hint">Diese Woche gibt es keine Karte.</p></MilaPage>

  const valid = card.ids.filter((id) => recipeById(id))
  const idx = valid.length - pending.length
  const current = recipeById(pending[0])
  const jokerUsed = mine.some((v) => v.meal === meal && v.vote === 'joker')
  const other = partner?.display_name ?? 'Der andere'

  const summary = cards
    .map((c) => `${c.ids.filter((id) => (voteOf(id, c.meal) ?? 'nein') !== 'nein').length} × ja auf der ${c.label}`)
    .join(' · ')

  return (
    <MilaPage>
      <KarteHead kicker={'Essen wählen · bis ' + deadline(menu.closes_at)} />
      {cards.length > 1 && !allDone && (
        <div className="m-tabs" role="tablist">
          {cards.map((c) => (
            <button key={c.meal} type="button" role="tab" aria-selected={c.meal === meal} className={'m-tab' + (c.meal === meal ? ' m-tab--on' : '')} onClick={() => setMeal(c.meal)}>
              {c.label}
            </button>
          ))}
          <span className="m-tabs__count">{Math.min(idx + 1, valid.length)} von {valid.length}</span>
        </div>
      )}

      {allDone ? (
        <div className="m-done">
          <span className="m-done__tick" aria-hidden>✓</span>
          <span className="m-title" style={{ fontSize: 34 }}>Fertig gewählt</span>
          <span className="m-hint">{summary}</span>
          {partner && !partnerDone && <span className="hand hand--brown" style={{ fontSize: 22 }}>{other} wählt noch … Aufdeckung, sobald ihr beide fertig seid, spätestens {deadline(menu.closes_at)}.</span>}
          {partner && partnerDone && <span className="hand hand--brown" style={{ fontSize: 22 }}>Gleich wird aufgedeckt …</span>}
          <div className="m-chips" style={{ justifyContent: 'center', marginTop: 6 }}>
            {cards.map((c) => (
              <button key={c.meal} type="button" className="m-day__link" onClick={() => { setMeal(c.meal); resetVotes(menu, c.meal) }}>{c.label} nochmal von vorn</button>
            ))}
          </div>
        </div>
      ) : current ? (
        <SwipeCard
          key={current.id + meal}
          recipe={current}
          last={lastLabel(lastEaten(weekDays, current.id, menu.week), today())}
          jokerUsed={jokerUsed}
          onVote={(k) => vote(menu, current.id, meal, k)}
        />
      ) : null}

      {!allDone && (
        <p className="m-hint m-karte__hint">
          ✕ nein · ✓ ja · ★ unbedingt (1 Joker pro Karte){partner ? ` · ${other} sieht deine Wahl nicht` : ''}
          {idx > 0 && (
            <>
              {' · '}
              <button type="button" className="link" style={{ fontSize: 13 }} onClick={() => resetVotes(menu, meal)}>nochmal von vorn</button>
            </>
          )}
        </p>
      )}
    </MilaPage>
  )
}

function SwipeCard({ recipe, last, jokerUsed, onVote }: { recipe: MilaRecipe; last: string; jokerUsed: boolean; onVote: (k: MilaVoteKind) => void }) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [out, setOut] = useState<MilaVoteKind | null>(null)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)

  function fling(k: MilaVoteKind) {
    if (out) return
    if (k === 'joker' && jokerUsed) return
    setOut(k)
    setTimeout(() => onVote(k), 200)
  }
  function down(e: RPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }
  function up() {
    const d = drag
    start.current = null
    setDrag(null)
    if (!d) return
    if (d.y < -SWIPE && Math.abs(d.y) > Math.abs(d.x) && !jokerUsed) fling('joker')
    else if (d.x > SWIPE) fling('ja')
    else if (d.x < -SWIPE) fling('nein')
  }

  const tags = [minutes(recipe.time_min), recipe.valerie_mag ? 'Valerie mag’s' : '', recipe.cook_double ? 'doppelt → Mittag' : '', recipe.prep_box ? 'Prep-Box' : ''].filter(Boolean)
  const hint = drag ? (drag.y < -40 && Math.abs(drag.y) > Math.abs(drag.x) ? 'joker' : drag.x > 40 ? 'ja' : drag.x < -40 ? 'nein' : null) : null
  const style = drag ? { transform: `translate(${drag.x}px, ${Math.min(drag.y, 30)}px) rotate(${drag.x / 18 - 0.8}deg)`, transition: 'none' } : undefined

  return (
    <div className="m-swipe">
      <div
        className={'m-card' + (out ? ' m-card--out-' + out : '')}
        style={style}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span className="m-card__tape" aria-hidden />
        {hint && <span className={'m-card__stamp m-card__stamp--' + hint}>{hint === 'ja' ? '✓ ja' : hint === 'nein' ? '✕ nein' : '★ Joker'}</span>}
        <span className="m-card__cat">{cardLabel(recipe)}</span>
        <span className="m-card__name">{recipe.name}</span>
        {cardBlurb(recipe) && <span className="m-card__blurb">{cardBlurb(recipe)}</span>}
        <span className="m-card__tags">
          {tags.map((t) => (
            <span key={t} className="m-tag">{t}</span>
          ))}
        </span>
        <span className="m-card__last">{last}</span>
      </div>
      <div className="m-vote">
        <button type="button" className="m-vote__btn m-vote__btn--no" aria-label="Nein" onClick={() => fling('nein')}>✕</button>
        <button type="button" className="m-vote__btn m-vote__btn--star" aria-label={jokerUsed ? 'Joker schon vergeben' : 'Unbedingt (Joker)'} disabled={jokerUsed} onClick={() => fling('joker')}>★</button>
        <button type="button" className="m-vote__btn m-vote__btn--yes" aria-label="Ja" onClick={() => fling('ja')}>✓</button>
      </div>
    </div>
  )
}
