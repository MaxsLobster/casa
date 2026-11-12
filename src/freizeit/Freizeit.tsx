// Freizeit · Wochenend-Tipps vom Freizeit-Scout. Eine Seite: Wochenende, Alarme, Haupttipps, Plan B / Oma / Vorschau, unsere Ausflüge.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { useSplashGone } from '../state/splash'
import { Chevron, Collapse } from '../components/ui'
import { alarmOpen, currentRadar, tippDay, weekendLabel, whenLabel } from '../lib/freizeit'
import type { FreizeitStatus, FreizeitTipp } from '../lib/types'
import './freizeit.css'

const GROUPS: { typ: FreizeitTipp['typ']; label: string }[] = [
  { typ: 'planb', label: '☔ Plan B' },
  { typ: 'oma', label: '👵 Mit Oma/Opa' },
  { typ: 'vorschau', label: '👀 Vorschau' },
]

const ACTIONS: { status: FreizeitStatus; label: string }[] = [
  { status: 'machen', label: '👍 Machen wir' },
  { status: 'nix', label: '👎 Nix für uns' },
  { status: 'gemacht', label: '✅ Waren dort' },
]
const DONE_LABEL: Record<FreizeitStatus, string> = { neu: '', machen: 'Machen wir', nix: 'Nix für uns', gemacht: 'Waren dort' }

const deDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`

export function Freizeit() {
  const splashGone = useSplashGone()
  const { freizeitRadars, freizeitTipps } = useCasa()
  const today = useToday()
  const [params] = useSearchParams()
  const focus = params.get('tipp')
  const [open, setOpen] = useState<string | null>(null)

  const radar = currentRadar(freizeitRadars, today)
  const mine = freizeitTipps.filter((t) => radar && t.radar_id === radar.id)
  const byTyp = (typ: FreizeitTipp['typ']) => mine.filter((t) => t.typ === typ).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  const alarms = freizeitTipps.filter((t) => alarmOpen(t, today)).sort((a, b) => (a.frist ?? '9').localeCompare(b.frist ?? '9'))
  // Vorgemerkt: „Machen wir“ aus früheren Radaren oder Alarmen, noch nicht vorbei
  const planned = freizeitTipps
    .filter((t) => t.status === 'machen' && !(radar && t.radar_id === radar.id) && (tippDay(t) ?? '9999') >= today)
    .sort((a, b) => (tippDay(a) ?? '').localeCompare(tippDay(b) ?? ''))
  const done = freizeitTipps.filter((t) => t.status === 'gemacht').sort((a, b) => (tippDay(b) ?? b.erstellt_am).localeCompare(tippDay(a) ?? a.erstellt_am))
  const we = radar ? weekendLabel(radar.wochenende) : null

  // Sprung aus der Woche: Gruppe des Tipps aufklappen
  useEffect(() => {
    const t = focus ? freizeitTipps.find((x) => x.id === focus) : null
    if (t && GROUPS.some((g) => g.typ === t.typ)) setOpen(t.typ)
  }, [focus, freizeitTipps])

  return (
    <div className="app frei">
      <div className="panes">
        <div className="pane">
          <div className="page frei__page">
            <div className="frei__top">
              <Link to="/heute" className="frei__back">‹ Casa</Link>
              <span className="frei__brand">Freizeit</span>
            </div>

            {!radar && !alarms.length && (
              <div className="stack" style={{ gap: 8, paddingTop: 24 }}>
                <h1 className="h1">Freizeit</h1>
                <p className="hand hand--navy">Noch kein Radar da. Der Freizeit-Scout meldet sich vor dem Wochenende.</p>
              </div>
            )}

            {radar && we && (
              <header className="frei__head">
                <span className="kicker">Wochenende</span>
                <h1 className="frei__date">
                  {we.days} <span>{we.month}</span>
                </h1>
                {radar.wetter && <p className="frei__wetter">{radar.wetter}</p>}
              </header>
            )}

            {alarms.map((t) => <Card key={t.id} t={t} alarm focus={focus === t.id} />)}

            {byTyp('haupt').map((t) => <Card key={t.id} t={t} focus={focus === t.id} />)}

            {GROUPS.map((g) => {
              const list = byTyp(g.typ)
              if (!list.length) return null
              const isOpen = open === g.typ
              return (
                <section key={g.typ} className="frei__group">
                  <button type="button" className="frei__grouphead" onClick={() => setOpen(isOpen ? null : g.typ)} aria-expanded={isOpen}>
                    <span>{g.label}</span>
                    <span className="frei__peek">{isOpen ? '' : list.map((t) => t.titel).join(' · ')}</span>
                    <Chevron open={isOpen} />
                  </button>
                  <Collapse open={isOpen}>
                    <div className="frei__groupbody">{list.map((t) => <Card key={t.id} t={t} small focus={focus === t.id} />)}</div>
                  </Collapse>
                </section>
              )
            })}

            {planned.length > 0 && (
              <section className="stack" style={{ gap: 10 }}>
                <span className="frei__label">Vorgemerkt</span>
                {planned.map((t) => <Card key={t.id} t={t} small focus={focus === t.id} />)}
              </section>
            )}

            {done.length > 0 && (
              <section className="stack" style={{ gap: 4 }}>
                <span className="frei__label">Unsere Ausflüge</span>
                {done.map((t) => (
                  <div key={t.id} className="frei__trip">
                    <span className="frei__tripday">{tippDay(t) ? `${deDate(tippDay(t)!)}${tippDay(t)!.slice(0, 4) !== today.slice(0, 4) ? tippDay(t)!.slice(2, 4) : ''}` : ''}</span>
                    <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                      {t.link ? <a href={t.link} target="_blank" rel="noopener noreferrer" className="frei__tripname">{t.titel}</a> : <span className="frei__tripname">{t.titel}</span>}
                      {(t.ort || t.notiz) && <span className="frei__tripnote">{[t.ort, t.notiz].filter(Boolean).join(' · ')}</span>}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      </div>
      {splashGone && <div className="edge" aria-hidden="true" />}
    </div>
  )
}

function Card({ t, alarm, small, focus }: { t: FreizeitTipp; alarm?: boolean; small?: boolean; focus?: boolean }) {
  const { setFreizeitStatus, setFreizeitNotiz, members } = useCasa()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(t.notiz ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (focus) window.setTimeout(() => ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
  }, [focus])
  useEffect(() => setNote(t.notiz ?? ''), [t.notiz])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  const choose = (s: FreizeitStatus) =>
    run(async () => {
      await setFreizeitStatus(t.id, s)
      setNoteOpen(true)
    })
  const undo = () =>
    run(async () => {
      await setFreizeitStatus(t.id, 'neu')
      setNoteOpen(false)
    })
  const saveNote = () =>
    run(async () => {
      await setFreizeitNotiz(t.id, note.trim() || null)
      setNoteOpen(false)
    })

  const when = whenLabel(t)
  const place = [t.ort, t.fahrzeit_min != null ? `🚗 ${t.fahrzeit_min} Min` : null].filter(Boolean).join(' · ')
  const signup = t.anmeldung === 'ja' ? 'Anmeldung nötig' : t.anmeldung === 'nein' ? 'ohne Anmeldung' : null
  const frist = t.frist ? `Frist ${deDate(t.frist)}` : null
  const preis = t.preis && /^(nicht angegeben|unbekannt)$/i.test(t.preis) ? 'Preis nicht angegeben' : t.preis
  const facts = [preis, signup, alarm ? null : frist].filter(Boolean).join(' · ')
  const who = t.feedback_von ? members.find((m) => m.id === t.feedback_von)?.display_name : null

  const body = (
    <>
      {alarm && <span className="frei__alarm">🔔 Jetzt kümmern{frist ? ` · ${frist}` : ''}</span>}
      <span className="frei__title">{t.titel}</span>
      {when && <span className="frei__when">{when}</span>}
      {place && <span className="frei__fact">{place}</span>}
      {facts && <span className="frei__fact">{facts}</span>}
      {alarm && t.grund && <p className="frei__why">{t.grund}</p>}
      {t.warum_valerie && (
        <p className="frei__why">
          <b>Warum für Valerie</b> {t.warum_valerie}
        </p>
      )}
      {t.fuer_euch && (
        <p className="frei__why">
          <b>Für euch</b> {t.fuer_euch}
        </p>
      )}
      {t.hinweis && <span className="frei__tag">{t.hinweis}</span>}
    </>
  )

  return (
    <article ref={ref} className={'frei__card' + (alarm ? ' frei__card--alarm' : '') + (small ? ' frei__card--small' : '') + (t.status === 'nix' ? ' frei__card--nix' : '') + (focus ? ' frei__card--focus' : '')}>
      {t.link ? (
        <a href={t.link} target="_blank" rel="noopener noreferrer" className="frei__body">
          {body}
          <span className="frei__more">Zur Seite ›</span>
        </a>
      ) : (
        <div className="frei__body">{body}</div>
      )}

      {t.status === 'neu' ? (
        <div className="frei__actions">
          {ACTIONS.map((a) => (
            <button key={a.status} type="button" className="frei__btn" disabled={busy} onClick={() => choose(a.status)}>{a.label}</button>
          ))}
        </div>
      ) : (
        <div className="frei__state">
          <span className="frei__stamp">
            {ACTIONS.find((a) => a.status === t.status)?.label.slice(0, 2)} {DONE_LABEL[t.status]}
            {who ? <i> · {who}</i> : null}
          </span>
          {t.status === 'machen' && <button type="button" className="frei__link" disabled={busy} onClick={() => choose('gemacht')}>✅ Waren dort</button>}
          <button type="button" className="frei__link" disabled={busy} onClick={undo}>Rückgängig</button>
        </div>
      )}
      {t.status === 'machen' && t.event_id && <span className="frei__hint">Steht in der Woche, für euch beide.</span>}

      {t.status !== 'neu' && !noteOpen && (
        <button type="button" className="frei__note" onClick={() => setNoteOpen(true)}>{t.notiz ? `„${t.notiz}“` : '+ kurze Notiz'}</button>
      )}
      {t.status !== 'neu' && noteOpen && (
        <div className="frei__noteedit">
          <input className="input-ui" value={note} maxLength={200} placeholder="Kurze Notiz (freiwillig)" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNote()} />
          <button type="button" className="frei__btn frei__btn--on" disabled={busy} onClick={saveNote}>Fertig</button>
        </div>
      )}
      {err && <span className="hint hint--brown">{err}</span>}
    </article>
  )
}
