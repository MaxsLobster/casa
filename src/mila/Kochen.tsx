// Mila · Kochmodus: Vollbild in Navy, ein Schritt pro Seite, Timer, Wake Lock, Thermomix-Kacheln
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMila } from './MilaContext'
import { scaleAmount } from './portions'
import { formatAmount } from './shopping'
import type { MilaIngredient, MilaStep } from '../lib/types'


/** Anzeige-Schritt: echte Schritte plus Schritt 0 „Bereitlegen“ */
interface CookStep {
  num: number
  title: string | null
  text: string
  timerSec: number | null
  tm: boolean
  tmTemp: string | null
  tmSpeed: string | null
  tmReverse: boolean
  ingredients: MilaIngredient[]
  prep: boolean
}

export function Kochen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { ready, recipeById, ingredientsOf, stepsOf } = useMila()
  const recipe = recipeById(id)

  const steps = useMemo<CookStep[]>(() => {
    if (!recipe) return []
    const ings = ingredientsOf(recipe.id)
    const byId = new Map(ings.map((i) => [i.id, i]))
    const real = stepsOf(recipe.id)
    const prep: CookStep = {
      num: 0,
      title: 'Bereitlegen',
      text: unassignedText(ings, real),
      timerSec: null,
      tm: false,
      tmTemp: null,
      tmSpeed: null,
      tmReverse: false,
      ingredients: ings,
      prep: true,
    }
    const rest = real.map<CookStep>((s, k) => ({
      num: k + 1,
      title: s.title,
      text: s.text,
      timerSec: s.is_thermomix ? s.tm_time_sec : s.timer_sec,
      tm: s.is_thermomix,
      tmTemp: s.tm_temp,
      tmSpeed: s.tm_speed,
      tmReverse: s.tm_reverse,
      ingredients: s.ingredient_ids.map((x) => byId.get(x)).filter(Boolean) as MilaIngredient[],
      prep: false,
    }))
    return [prep, ...rest]
  }, [recipe, ingredientsOf, stepsOf])

  const portions = Math.max(1, Number(params.get('p')) || recipe?.portions || 1)
  const factor = recipe ? portions / Math.max(1, recipe.portions) : 1

  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState<'next' | 'back'>('next')
  const awake = useWakeLock()
  const timer = useTimer()

  // Anderes Gericht unter derselben Route: wieder bei 0 anfangen
  useEffect(() => {
    setIdx(0)
    setDir('next')
    timer.reset()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    (delta: number) => {
      const n = idx + delta
      if (n < 0 || n >= steps.length) return
      timer.reset()
      setDir(delta > 0 ? 'next' : 'back')
      setIdx(n)
    },
    [idx, steps.length, timer],
  )

  // Pfeiltasten (am Rechner), Wischen (am Handy)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const t = touch.current
    touch.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) go(dx < 0 ? 1 : -1)
  }

  function close() {
    nav(recipe ? `/mila/gerichte/${recipe.id}` : '/mila/woche')
  }

  if (!ready) return <div className="m-cook"><span className="m-cook__dim">Einen Moment …</span></div>
  if (!recipe || !steps.length) {
    return (
      <div className="m-cook">
        <div className="m-cook__head">
          <button type="button" className="m-cook__x" aria-label="Kochmodus schließen" onClick={() => nav('/mila/gerichte')}><XIcon /></button>
        </div>
        <p className="m-cook__text" style={{ padding: 26 }}>Dieses Gericht gibt es nicht mehr.</p>
      </div>
    )
  }

  const step = steps[idx]
  const isFirst = idx === 0
  const isLast = idx === steps.length - 1
  const total = step.timerSec ?? 0
  const left = timer.left ?? total
  const done = total > 0 && timer.left === 0
  // „310 g Rinderhack“, aber „Fladenbrot zum Dippen“ wenn es keine Menge gibt
  const chip = (i: MilaIngredient) => {
    if (i.amount === null || i.amount === undefined) return i.unit ? `${i.name} ${i.unit.trim()}` : i.name
    return `${formatAmount(scaleAmount(i.amount, i.unit, factor), i.unit)} ${i.name}`
  }

  return (
    <div className="m-cook" role="region" aria-label="Kochmodus">
      <header className="m-cook__head">
        <div className="m-cook__top">
          <button type="button" className="m-cook__x" aria-label="Kochmodus schließen" onClick={close}><XIcon /></button>
          <span className="m-cook__name">{recipe.name}</span>
          {step.tm ? (
            <span className="m-cook__tm">TM</span>
          ) : awake ? (
            <span className="m-cook__awake">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
              </svg>
              bleibt an
            </span>
          ) : (
            <span className="m-cook__awake" style={{ visibility: 'hidden' }}>bleibt an</span>
          )}
        </div>
        <div className="m-cook__bars" aria-label={`Schritt ${idx + 1} von ${steps.length}`}>
          {steps.map((s, k) => (
            <span key={s.num} className={'m-cook__bar' + (k <= idx ? ' m-cook__bar--on' : '')} />
          ))}
        </div>
      </header>

      <main className="m-cook__main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={idx} className={'m-cook__step m-cook__step--' + dir}>
          <div className="m-cook__numrow">
            <span className="m-cook__num">{step.num}</span>
            {step.title ? <span className="m-cook__title">{step.title}</span> : <span className="m-cook__of">von {steps.length - 1}</span>}
          </div>
          <p className={'m-cook__text' + (step.tm || step.prep ? ' m-cook__text--s' : '')}>{step.text}</p>

          {step.ingredients.length > 0 && (
            <div className="m-cook__ings">
              <span className="m-cook__label">{step.prep ? 'Alles für ' + portions + (portions === 1 ? ' Portion' : ' Portionen') : step.tm ? 'In den Mixtopf · Waage auf null' : 'Brauchst du jetzt'}</span>
              <div className="m-cook__chips">
                {step.ingredients.map((i) => (
                  <span key={i.id} className="m-cook__chip">{chip(i)}</span>
                ))}
              </div>
            </div>
          )}

          {!step.tm && total > 0 && (
            <button type="button" className="m-cook__timer" onClick={() => timer.toggle(total)} aria-label={timer.running ? 'Timer pausieren' : 'Timer starten'}>
              <svg width="56" height="56" viewBox="0 0 60 60" aria-hidden>
                <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(244,241,234,0.15)" strokeWidth="4" />
                <circle cx="30" cy="30" r="26" fill="none" stroke="#D9B877" strokeWidth="4" strokeLinecap="round" strokeDasharray="163.4" strokeDashoffset={(163.4 * (1 - left / total)).toFixed(1)} transform="rotate(-90 30 30)" style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
              </svg>
              <span className="m-cook__clockwrap">
                <span className={'m-cook__clock' + (timer.running ? ' m-cook__clock--run' : '') + (done ? ' m-cook__clock--done' : '')}>{clock(left, total, timer.left === null)}</span>
                <span className="m-cook__label">{done ? 'fertig' : timer.running ? 'läuft · tippen für Pause' : timer.left === null ? 'Timer starten' : 'Pause · tippen geht weiter'}</span>
              </span>
            </button>
          )}
        </div>

        {step.tm && (
          <div key={'tm' + idx} className="m-cook__tiles-wrap">
            <div className="m-cook__tiles">
              <button type="button" className={'m-cook__tile m-cook__tile--time' + (timer.running ? ' m-cook__tile--run' : '')} onClick={() => total > 0 && timer.toggle(total)} aria-label={timer.running ? 'Timer pausieren' : 'Timer starten'} disabled={!total}>
                <span className="m-cook__label">Zeit</span>
                <span className={'m-cook__tileval' + (timer.running ? ' m-cook__clock--run' : '') + (done ? ' m-cook__clock--done' : '')} style={{ fontSize: clock(left, total, timer.left === null).length > 5 ? 24 : 30 }}>
                  {total ? clock(left, total, timer.left === null) : '–'}
                </span>
                <span className="m-cook__tilebar"><span className="m-cook__tilefill" style={{ width: total ? (100 * (1 - left / total)).toFixed(1) + '%' : '0%' }} /></span>
              </button>
              <div className="m-cook__tile">
                <span className="m-cook__label">Temperatur</span>
                <span className="m-cook__tileval" style={{ fontSize: tempLabel(step.tmTemp).length > 3 ? 24 : 30 }}>{tempLabel(step.tmTemp)}</span>
              </div>
              <div className="m-cook__tile">
                <span className="m-cook__label">Stufe</span>
                <span className="m-cook__tileval m-cook__speed">
                  {step.tmSpeed || '–'}
                  {step.tmReverse && (
                    <span className={'m-cook__rev' + (timer.running ? ' m-cook__rev--spin' : '')}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D9B877" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Linkslauf">
                        <path d="M4 12a8 8 0 1 0 2.4-5.7" />
                        <path d="M4 3v4.5h4.5" />
                      </svg>
                    </span>
                  )}
                </span>
              </div>
            </div>
            <span className="m-cook__hint">
              {done ? 'Fertig – weiter zum nächsten Schritt.' : timer.running ? 'Läuft. Tippen auf die Zeit pausiert.' : timer.left !== null ? 'Pause. Tippen auf die Zeit macht weiter.' : total ? 'Am Thermomix einstellen – oder auf die Zeit tippen, dann läuft der Countdown hier mit.' : 'Am Thermomix einstellen.'}
            </span>
          </div>
        )}
      </main>

      <footer className="m-cook__foot">
        <button type="button" className="m-cook__prev" aria-label="Vorheriger Schritt" disabled={isFirst} onClick={() => go(-1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        {isLast ? (
          <button type="button" className="m-cook__done" onClick={close}>Fertig · guten Appetit</button>
        ) : (
          <button type="button" className="m-cook__next" onClick={() => go(1)}>
            {isFirst ? 'Los geht’s' : 'Weiter'}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
          </button>
        )}
      </footer>
    </div>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
  )
}

/** Text für Schritt 0: nennt, was in keinem Schritt extra vorkommt */
function unassignedText(ings: MilaIngredient[], steps: MilaStep[]): string {
  const used = new Set(steps.flatMap((s) => s.ingredient_ids))
  const loose = ings.filter((i) => !used.has(i.id))
  if (!loose.length) return 'Alles bereitstellen und abwiegen, dann geht es los.'
  if (loose.length === ings.length) return 'Alles bereitstellen und abwiegen, dann geht es los.'
  const names = loose.map((i) => i.name)
  const list = names.length > 4 ? names.slice(0, 4).join(', ') + ' und mehr' : names.join(', ')
  return `Alles bereitstellen und abwiegen. ${list}: ${loose.length === 1 ? 'kommt' : 'kommen'} in keinem Schritt extra vor, also gleich griffbereit halten.`
}

function tempLabel(t: string | null): string {
  const v = (t ?? '').trim()
  if (!v) return '–'
  if (/^\d+$/.test(v)) return v + ' °C'
  return v
}

/** „5 Sek“ vor dem Start bei kurzen Zeiten, sonst mm:ss (eine Stunde = 60:00) */
function clock(left: number, total: number, fresh: boolean): string {
  if (fresh && total < 60) return `${total} Sek`
  if (total < 60) return `${left} Sek`
  const mm = Math.floor(left / 60)
  const ss = left % 60
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`
}

/** Bildschirm an, solange der Kochmodus offen ist (Screen Wake Lock) */
function useWakeLock(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    type Lock = { release(): Promise<void>; addEventListener(t: 'release', f: () => void): void }
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Lock> } }).wakeLock
    if (!wl) return
    let lock: Lock | null = null
    let gone = false
    const get = async () => {
      try {
        lock = await wl.request('screen')
        if (gone) {
          lock.release()
          return
        }
        setOn(true)
        lock.addEventListener('release', () => setOn(false))
      } catch {
        setOn(false)
      }
    }
    get()
    const onVisible = () => {
      if (document.visibilityState === 'visible') get()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
  return on
}

/** Countdown über Zeitstempel (läuft auch richtig weiter, wenn das Handy kurz schläft) */
function useTimer() {
  const [left, setLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const endAt = useRef<number | null>(null)
  const tick = useRef<number | null>(null)
  const audio = useRef<AudioContext | null>(null)

  const stop = useCallback(() => {
    if (tick.current) window.clearInterval(tick.current)
    tick.current = null
  }, [])

  const finish = useCallback(() => {
    stop()
    endAt.current = null
    setRunning(false)
    setLeft(0)
    chime(audio.current)
    try {
      navigator.vibrate?.([220, 120, 220])
    } catch {
      /* nicht überall erlaubt */
    }
  }, [stop])

  const toggle = useCallback(
    (total: number) => {
      if (running) {
        stop()
        const l = Math.max(0, Math.ceil(((endAt.current ?? 0) - Date.now()) / 1000))
        endAt.current = null
        setLeft(l)
        setRunning(false)
        return
      }
      const start = left ?? total
      if (start <= 0) return
      // Ton braucht eine Berührung, deshalb hier anlegen
      try {
        audio.current = audio.current ?? new AudioContext()
        audio.current.resume()
      } catch {
        audio.current = null
      }
      endAt.current = Date.now() + start * 1000
      setLeft(start)
      setRunning(true)
      stop()
      tick.current = window.setInterval(() => {
        const l = Math.ceil(((endAt.current ?? 0) - Date.now()) / 1000)
        if (l <= 0) finish()
        else setLeft(l)
      }, 250)
    },
    [running, left, stop, finish],
  )

  const reset = useCallback(() => {
    stop()
    endAt.current = null
    setLeft(null)
    setRunning(false)
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return { left, running, toggle, reset }
}

/** Sanfter Zweiklang am Ende des Timers */
function chime(ctx: AudioContext | null) {
  if (!ctx) return
  try {
    const t0 = ctx.currentTime
    const notes = [659.25, 880] // E5, A5
    notes.forEach((f, k) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = t0 + k * 0.28
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 1)
    })
  } catch {
    /* kein Ton, kein Drama */
  }
}
