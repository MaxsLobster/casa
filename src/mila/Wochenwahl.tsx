// Mila · Wochenwahl: Anzahl wählen, Stapel wischen (rechts ja, links nö, hoch ★), Treffer-Moment, danach die Kombo.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMila } from './MilaContext'
import { MilaBand, Initial } from './Band'
import { Kombo } from './Kombo'
import { minutes } from './rhythm'
import { kicker as recipeKicker, stats } from './recipe-view'
import { SWIPE_PX, deckFor } from './wahl'
import { tileKind } from './portions'
import { TileIcon } from './icons'
import { addDays, fromISO, isoWeek, startOfWeek, today as todayISO } from '../lib/dates'
import type { MilaDeckCard, MilaWahl, MilaWeekPlan } from '../lib/types'

const MONTHS = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
export function weekLabel(week: string): string {
  const a = fromISO(week)
  const b = fromISO(addDays(week, 6))
  return `KW ${isoWeek(week)} · ${a.getDate()}.${a.getMonth() === b.getMonth() ? '' : ` ${MONTHS[a.getMonth()]} `}–${b.getDate()}. ${MONTHS[b.getMonth()]}`
}

export function countdown(deadline: string, now = Date.now()): string {
  const ms = new Date(deadline).getTime() - now
  if (ms <= 0) return 'Wahl geschlossen'
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  const rest = h % 24
  const end = new Date(deadline)
  const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][end.getDay()]
  const when = `bis ${wd} ${end.getHours()}${end.getMinutes() ? ':' + String(end.getMinutes()).padStart(2, '0') : ''} Uhr`
  if (d >= 1) return `noch ${d} ${d === 1 ? 'Tag' : 'Tage'}${rest ? ` ${rest} Std` : ''} · ${when}`
  if (h >= 1) return `noch ${h} Std · ${when}`
  return `noch ${Math.max(1, Math.round(ms / 60000))} Min · ${when}`
}

/** Kombo der laufenden Woche (auch während die Wahl für die nächste läuft) */
export function LaufendeKombo() {
  const { ready, wahl } = useMila()
  if (!ready) return <div className="page"><span className="hint">Einen Moment …</span></div>
  const plan = wahl.currentPlan
  if (plan && plan.status !== 'wischen') return <Kombo plan={plan} />
  return (
    <div className="page mw">
      <MilaBand kicker="Diese Woche" title="Keine Kombo" />
      <p className="m-hint mw__pad">Für diese Woche gibt es keine Kombo.</p>
    </div>
  )
}

export function Wahl() {
  const { ready, wahl } = useMila()
  if (!ready) return <div className="page"><span className="hint">Einen Moment …</span></div>
  const plan = wahl.nextPlan
  if (plan) {
    if (plan.status === 'wischen') return plan.deck_built_at ? <Wischen plan={plan} /> : <Anzahl plan={plan} />
    return <Kombo plan={plan} />
  }
  if (wahl.currentPlan && wahl.currentPlan.status !== 'wischen') return <Kombo plan={wahl.currentPlan} />
  const gone = wahl.plans.some((p) => p.status === 'verworfen' && p.week >= startOfWeek(todayISO()))
  return (
    <div className="page mw">
      <MilaBand kicker="Wochenwahl" title="Noch nichts zu wählen" />
      <p className="m-hint mw__pad">{gone ? 'Die Woche ist verworfen. ' : ''}Ab Freitag stellt ihr hier die Anzahl für die nächste Woche ein und wischt euren Stapel.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Anzahl
// ---------------------------------------------------------------------------

function Anzahl({ plan }: { plan: MilaWeekPlan }) {
  const { wahl, partner } = useMila()
  const a = plan.abend_anzahl
  const m = plan.mittag_anzahl
  const set = (na: number, nm: number) => void wahl.setCounts(plan, Math.min(6, Math.max(3, na)), Math.min(4, Math.max(0, nm)))
  return (
    <div className="page mw">
      <MilaBand kicker={weekLabel(plan.week)} title="Wie viel kocht ihr?" chip={countdown(plan.deadline)} />
      <div className="mw__pad mw__stack">
        <span className="mw__lead">Wie bei HelloFresh: Ihr wählt nur die Anzahl. Wann ihr was kocht, plant Mila nach Frische und Prep.</span>
        <div className="mw__card">
          <Stepper title="Abendgerichte" sub="für 3 · 3 bis 6" value={a} minus={() => set(a - 1, m)} plus={() => set(a + 1, m)} label="Abendgericht" />
          <div className="mw__dash" />
          <Stepper title="Mittaggerichte" sub="für 2 · 0 bis 4 · meist als Box" value={m} minus={() => set(a, m - 1)} plus={() => set(a, m + 1)} label="Mittaggericht" />
        </div>
        <div className="mw__sum">
          <span className="mw__hand mw__hand--34">{a} Abend + {m} Mittag = {a + m} Mahlzeiten</span>
          <span className="m-hint">{m > 0 ? 'Mittag zuerst aus Resten („doppelt → Mittag“), den Rest füllen eigene Mittaggerichte' : 'ohne Mittagessen'}</span>
        </div>
        <div className="mw__note">
          <span><b>Euer Stapel:</b> {a * 3} Abend- und {m * 3} Mittagskarten pro Person</span>
          <span><b>Mila achtet auf:</b> viel aus dem Prep, doppelt kochen, Frisches zuerst</span>
          <span><b>Bis:</b> {countdown(plan.deadline).replace(/^noch .*? · bis /, '')}, dann kommt die Kombo</span>
        </div>
        <button type="button" className="mw__main" onClick={() => void wahl.startDeck(plan)}>Stapel mischen · los geht’s</button>
        <span className="mw__fine">{partner ? `${partner.display_name} sieht die Zahl sofort und kann sie auch ändern.` : ''} Sobald jemand wischt, steht die Anzahl fest.</span>
      </div>
    </div>
  )
}

function Stepper({ title, sub, value, minus, plus, label }: { title: string; sub: string; value: number; minus: () => void; plus: () => void; label: string }) {
  return (
    <div className="mw__step">
      <div className="mw__steptext">
        <span className="mw__hand mw__hand--28">{title}</span>
        <span className="m-hint" style={{ fontSize: 12 }}>{sub}</span>
      </div>
      <button type="button" className="mw__round" aria-label={`Ein ${label} weniger`} onClick={minus}>−</button>
      <span className="mw__hand mw__hand--40 mw__num">{value}</span>
      <button type="button" className="mw__round" aria-label={`Ein ${label} mehr`} onClick={plus}>+</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Wischen
// ---------------------------------------------------------------------------

const SEEN_KEY = 'mila.treffer.gesehen'
function seenMatches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
  } catch {
    return []
  }
}
function markSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seenMatches(), ...ids])].slice(-200)))
  } catch {
    /* privat */
  }
}

function Wischen({ plan }: { plan: MilaWeekPlan }) {
  const { wahl, me, partner, recipeById } = useMila()
  const nav = useNavigate()
  const [, setTick] = useState(0)
  const [match, setMatch] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const mine = wahl.mySwipes.filter((s) => s.plan_id === plan.id)
  const done = new Set(mine.map((s) => s.recipe_id))
  const order = useMemo(() => deckFor(plan.deck, me.id), [plan.deck, me.id])
  const queue = order.filter((c) => !done.has(c.recipe_id) && recipeById(c.recipe_id))
  const card = queue[0] ?? null
  const next = queue[1] ?? null
  const n = plan.deck.length
  const partnerDone = partner ? (wahl.stand[partner.id] ?? 0) : 0
  const planMatches = wahl.matches.filter((m) => m.plan_id === plan.id)
  const jokerLeft = wahl.jokerLeft(plan.id)

  // Treffer, die der andere ausgelöst hat: beim nächsten Öffnen zeigen
  useEffect(() => {
    const seen = new Set(seenMatches())
    const fresh = planMatches.filter((m) => !seen.has(m.id))
    if (fresh.length && !match) setMatch(fresh.map((m) => m.recipe_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planMatches.length])
  const closeMatch = () => {
    markSeen(planMatches.map((m) => m.id))
    setMatch(null)
  }

  async function decide(c: MilaDeckCard, w: MilaWahl) {
    if (busy) return
    setBusy(true)
    const res = await wahl.swipe(plan, c.recipe_id, w)
    setBusy(false)
    if (res.treffer) setMatch([c.recipe_id])
  }

  const gesucht = card ? (card.meal === 'abend' ? plan.abend_anzahl : plan.mittag_anzahl) : 0
  return (
    <div className="page mw mw--swipe">
      <MilaBand
        kicker={weekLabel(plan.week)}
        title="Wochenkarte"
        chip={countdown(plan.deadline)}
        right={
          <div className="mw__prog">
            <span><Initial name={me.display_name} /> Du {Math.min(mine.length, n)} von {n}</span>
            {partner && <span><Initial name={partner.display_name} partner /> {partner.display_name} {Math.min(partnerDone, n)} von {n}</span>}
          </div>
        }
      />
      <main className="mw__main-area">
        {card ? (
          <>
            <div className="mw__pills">
              <span className={'mw__pill' + (card.meal === 'abend' ? ' mw__pill--on' : '')}>Abend · {plan.abend_anzahl} gesucht</span>
              {plan.mittag_anzahl > 0 && <span className={'mw__pill' + (card.meal === 'mittag' ? ' mw__pill--on mw__pill--mittag' : '')}>Mittag · {plan.mittag_anzahl} gesucht</span>}
              <span className="rk-grow" />
              <span className="m-hint" style={{ fontSize: 12 }}>{planMatches.length === 1 ? '1 Treffer' : `${planMatches.length} Treffer`}</span>
            </div>
            <SwipeCard key={card.recipe_id} card={card} hasNext={!!next} jokerLeft={jokerLeft} onDecide={(w) => decide(card, w)} onOpen={() => nav(`/mila/rezept/${card.recipe_id}`)} gesucht={gesucht} />
            <span className="mw__fine">← nö · ja → · ↑ unbedingt (noch {jokerLeft} Joker){partner ? ` · ${partner.display_name} sieht nur eure Treffer` : ''}</span>
          </>
        ) : (
          <div className="mw__done">
            <span className="mw__hand mw__hand--42">Fertig gewischt</span>
            <span className="mw__lead" style={{ fontStyle: 'normal' }}>
              Du willst {mine.filter((s) => s.wahl !== 'nein').length} von {n} · {planMatches.length} Treffer
            </span>
            <span className="mw__lead">
              {partner && partnerDone < n ? `${partner.display_name} fehlen noch ${n - partnerDone} Karten. ` : ''}
              Sonntag um 20 Uhr wird eure Kombo gebaut – oder sofort, wenn ihr beide fertig seid.
            </span>
            <button type="button" className="mw__again" onClick={() => void wahl.resetSwipes(plan)}>nochmal von vorn</button>
          </div>
        )}
        {match && <MatchOverlay ids={match} partnerName={partner?.display_name ?? ''} me={me.display_name} onClose={closeMatch} onOpen={(id) => { closeMatch(); nav(`/mila/rezept/${id}`) }} />}
      </main>
    </div>
  )
}

function SwipeCard({ card, hasNext, jokerLeft, onDecide, onOpen, gesucht }: { card: MilaDeckCard; hasNext: boolean; jokerLeft: number; onDecide: (w: MilaWahl) => void; onOpen: () => void; gesucht: number }) {
  const { recipeById, photoUrl } = useMila()
  const r = recipeById(card.recipe_id)!
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [fly, setFly] = useState<MilaWahl | null>(null)
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  void gesucht

  function go(w: MilaWahl) {
    if (fly) return
    if (w === 'stern' && jokerLeft <= 0) {
      setDrag(null)
      return
    }
    setFly(w)
    setDrag(null)
    window.setTimeout(() => onDecide(w), 320)
  }
  function down(e: RPointerEvent<HTMLDivElement>) {
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }
  function up(e: RPointerEvent<HTMLDivElement>) {
    const s0 = start.current
    start.current = null
    if (!s0) return
    const dx = e.clientX - s0.x
    const dy = e.clientY - s0.y
    // Tipp: kaum bewegt und kurz → Rezeptkarte
    if (e.type === 'pointerup' && Math.hypot(dx, dy) < 8 && Date.now() - s0.t < 450) {
      setDrag(null)
      onOpen()
      return
    }
    if (dx > SWIPE_PX) go('ja')
    else if (dx < -SWIPE_PX) go('nein')
    else if (dy < -SWIPE_PX && Math.abs(dx) < 60) go('stern')
    else setDrag(null)
  }

  const dx = drag?.x ?? 0
  const dy = drag?.y ?? 0
  const pYes = fly === 'ja' ? 1 : Math.max(0, Math.min(1, dx / SWIPE_PX))
  const pNo = fly === 'nein' ? 1 : Math.max(0, Math.min(1, -dx / SWIPE_PX))
  const pStar = fly === 'stern' ? 1 : Math.abs(dx) < 60 ? Math.max(0, Math.min(1, -dy / SWIPE_PX)) : 0
  const transform = fly === 'ja' ? 'translate(520px,-40px) rotate(24deg)' : fly === 'nein' ? 'translate(-520px,-40px) rotate(-24deg)' : fly === 'stern' ? 'translate(0,-700px) rotate(-4deg)' : `translate(${dx}px, ${Math.min(dy, 40)}px) rotate(${dx / 18 - 0.6}deg)`
  const st = stats(r, 'original')
  const src = photoUrl(r.photo_path)
  const kind = tileKind(r)
  const chips = [...(r.tags ?? []).slice(0, 2), r.cook_double ? 'doppelt → Mittag' : null, r.prep_box ? 'Prep' : null].filter(Boolean) as string[]

  return (
    <div className="mw__stage">
      {hasNext && <div className="mw__under" aria-hidden />}
      <div
        className="mw__card-swipe"
        style={{ transform, opacity: fly ? 0 : 1, transition: drag ? 'none' : 'transform 0.32s ease-in, opacity 0.32s ease-in' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="group"
        aria-label={r.name}
      >
        <span className="rk-tape" aria-hidden />
        <div className={'mw__photo' + (src ? ' mw__photo--img' : ' m-tile__pic--' + kind)}>
          {src ? <img src={src} alt="" draggable={false} /> : <TileIcon kind={kind} size={56} />}
          <span className={'rk-pill rk-pill--meal' + (card.meal === 'mittag' ? ' mw__badge-mittag' : '')}>{card.meal === 'abend' ? 'Abend' : 'Mittag'}</span>
          <span className="mw__stamp mw__stamp--ja" style={{ opacity: pYes }}>Ja</span>
          <span className="mw__stamp mw__stamp--nein" style={{ opacity: pNo }}>Nö</span>
          <span className="mw__stamp mw__stamp--stern" style={{ opacity: pStar }}>★ Unbedingt</span>
        </div>
        <div className="mw__body">
          <span className="rk-caps">{recipeKicker(r)}</span>
          <span className="mw__name">{r.name}</span>
          {r.subtitle && <span className="rk-sub" style={{ fontSize: 14 }}>{r.subtitle}</span>}
          <div className="mw__facts">
            <span><b>{r.time_min ? minutes(r.time_min) : '–'}</b></span>
            <span><b>{st.kcal}</b> kcal</span>
            <span><b>{st.protein}</b> Protein</span>
          </div>
          <div className="rk-chips">
            {chips.map((c) => (
              <span key={c} className="rk-chip">{c}</span>
            ))}
          </div>
          <span className="rk-grow" />
          <span className="mw__fine">antippen = Rezeptkarte · ziehen = wählen</span>
        </div>
      </div>
      <div className="mw__buttons">
        <button type="button" className="mw__vote mw__vote--no" aria-label="Nö" onClick={() => go('nein')}>✕</button>
        <button type="button" className="mw__vote mw__vote--star" aria-label={jokerLeft ? 'Unbedingt (Joker)' : 'Beide Joker vergeben'} disabled={!jokerLeft} onClick={() => go('stern')}>★</button>
        <button type="button" className="mw__vote mw__vote--yes" aria-label="Ja" onClick={() => go('ja')}>✓</button>
      </div>
    </div>
  )
}

function MatchOverlay({ ids, me, partnerName, onClose, onOpen }: { ids: string[]; me: string; partnerName: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { recipeById } = useMila()
  const names = ids.map((id) => recipeById(id)?.name).filter(Boolean) as string[]
  if (!names.length) return null
  return (
    <div className="mw__match" role="dialog" aria-label="Treffer">
      <span className="mw__match-title">Treffer!</span>
      <div className="mw__match-pair">
        <Initial name={me} size={64} />
        <Initial name={partnerName || 'A'} partner size={64} />
      </div>
      {names.map((n) => (
        <span key={n} className="mw__match-name">{n}</span>
      ))}
      <span className="mw__match-sub">{partnerName ? `${partnerName} will das auch` : 'Ihr wollt beide'} – steht fix auf eurer Woche.</span>
      <button type="button" className="mw__match-btn" onClick={onClose}>Weiter wischen</button>
      <button type="button" className="mw__match-link" onClick={() => onOpen(ids[0])}>Rezeptkarte ansehen</button>
    </div>
  )
}
