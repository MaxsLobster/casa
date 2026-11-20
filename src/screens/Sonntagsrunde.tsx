// Sonntagsrunde in höchstens 4 Schritten (Casa): 1 Geschafft diese Woche · 2 die kommende Woche · 3 Anker · 4 Essensplan.
// Im MWF-Bereich bleibt es bei den Ankern.
import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import { groupOf, logDate, phaseLabel, stepMeta, stepOf } from '../lib/anchors'
import { AnchorIcon, PhaseBars, PhasePicker, StepForm } from './AnkerTeile'
import { areaBase, useArea } from '../state/area'
import { addDays, lastSundayCutoff, startOfWeek, toISO, weekDates, weekdayShort } from '../lib/dates'
import { occurrences } from '../lib/recur'
import { applyEffects, dayEffects, type DayEffects } from '../lib/effects'
import { dayState, type DayState } from '../lib/week'
import { daySegments } from '../lib/day'
import { Takeover } from './Takeover'

type Mode = null | 'step' | 'phase' | 'note'
type Stage = 'geschafft' | 'woche' | 'anker' | 'essen' | 'fertig'
const STAGES: Stage[] = ['geschafft', 'woche', 'anker', 'essen']

export function Sonntagsrunde() {
  const casa = useCasa()
  const { anchors: allAnchors, anchorLog, tasks, members, setAnchorPhase, addAnchorLog } = casa
  const area = useArea()
  const base = areaBase(area)
  const anchors = useMemo(() => allAnchors.filter((a) => a.area === area), [allAnchors, area])
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()

  // Reihenfolge wird beim Start festgelegt, damit sie sich während der Runde nicht verschiebt
  const [order] = useState<string[]>(() => {
    const list = anchors.filter((a) => !a.archived_at && a.visibility === 'shared')
    const rank = (id: string) => {
      const a = anchors.find((x) => x.id === id)!
      return groupOf(a, now) === 'ruht' ? 0 : groupOf(a, now) === 'bewegung' ? 1 : 2
    }
    return list.sort((a, b) => rank(a.id) - rank(b.id) || a.moved_at.localeCompare(b.moved_at)).map((a) => a.id)
  })
  // Vom Anker aus („In der Sonntagsrunde ›“) direkt zu diesem Anker
  const [params] = useSearchParams()
  const jump = params.get('anker')
  const [stage, setStage] = useState<Stage>(() => (area !== 'casa' || jump ? 'anker' : 'geschafft'))
  const [pos, setPos] = useState(() => Math.max(0, jump ? order.indexOf(jump) : 0))
  const [mode, setMode] = useState<Mode>(null)
  const [noteText, setNoteText] = useState('')
  const [busy, setBusy] = useState(false)

  const anchor = anchors.find((a) => a.id === order[pos]) ?? null
  const step = anchor ? stepOf(anchor.id, tasks) : null
  const recent = useMemo(() => (anchor ? anchorLog.filter((l) => l.anchor_id === anchor.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3) : []), [anchorLog, anchor])

  async function next() {
    if (!anchor || busy) return
    setBusy(true)
    try {
      await addAnchorLog(anchor.id, 'sunday', 'Sonntagsrunde: besprochen')
    } finally {
      setBusy(false)
    }
    setMode(null)
    setNoteText('')
    if (pos + 1 >= order.length && area === 'casa') setStage('essen')
    setPos((p) => p + 1)
  }

  if (area === 'casa' && stage !== 'anker') {
    return <RundeSchritt stage={stage} setStage={setStage} anchorsCount={order.length} />
  }

  if (order.length === 0 && area === 'casa') {
    return <RundeSchritt stage="essen" setStage={setStage} anchorsCount={0} />
  }
  if (order.length === 0) {
    return (
      <div className="page" style={{ gap: 16 }}>
        <Link to={base + '/anker'} className="ank__back">‹ Alle Anker</Link>
        <h1 className="h1">Sonntagsrunde</h1>
        <p className="hint">Es gibt noch keine gemeinsamen Anker.</p>
      </div>
    )
  }

  if (!anchor) {
    return (
      <div className="page" style={{ gap: 16 }}>
        <Link to={base + '/anker'} className="ank__back">‹ Alle Anker</Link>
        <h1 className="h1">Sonntagsrunde</h1>
        <p className="hand hand--navy" style={{ fontSize: 31, lineHeight: 1.15 }}>Fertig – bis nächsten Sonntag.</p>
        <p className="hint">{order.length === 1 ? 'Ein Anker besprochen.' : `${order.length} Anker besprochen.`} Jeder hat einen Eintrag im Verlauf bekommen.</p>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start', width: 'auto', padding: '10px 22px' }} onClick={() => nav(base + '/anker')}>Zu den Ankern</button>
      </div>
    )
  }

  return (
    <div className="page" style={{ gap: 16 }}>
      <div className="between">
        <Link to={base + '/anker'} className="ank__back">‹ Abbrechen</Link>
        <span className="ank__progress">{area === 'casa' ? `Schritt 3 von 4 · Anker ${pos + 1} von ${order.length}` : `${pos + 1} von ${order.length}`}</span>
      </div>
      <header className="stack" style={{ gap: 6 }}>
        <span className="kicker">Sonntagsrunde</span>
        <span className="ank__row">
          <AnchorIcon size={22} />
          <span className="h1" style={{ fontSize: 39.5, lineHeight: 1 }}>{anchor.title}</span>
        </span>
        {anchor.why && <span className="ank__why">{anchor.why}</span>}
        {mode === 'phase' ? (
          <PhasePicker phase={anchor.phase} onChange={async (p) => { if (p !== anchor.phase) await setAnchorPhase(anchor.id, p); setMode(null) }} />
        ) : (
          <PhaseBars phase={anchor.phase} />
        )}
      </header>

      <section className="stack" style={{ gap: 8 }}>
        <span className="label">Stand</span>
        {recent.length === 0 && <span className="hint">Noch kein Verlauf.</span>}
        {recent.map((l) => (
          <div className="ank__log" key={l.id}>
            <span className="ank__logdate">{logDate(l.at, today)}</span>
            <span className="ank__logtext">{l.text}</span>
          </div>
        ))}
      </section>

      <div className="note ank__note">
        <span className="label label--small">{mode === 'step' ? (step ? 'Schritt ändern' : 'Nächster Schritt') : 'Nächster Schritt'}</span>
        {mode === 'step' ? (
          <StepForm anchorId={anchor.id} step={step} onDone={() => setMode(null)} onCancel={() => setMode(null)} cancelLabel="abbrechen" />
        ) : step ? (
          <>
            <span className="hand hand--navy" style={{ fontSize: 27, lineHeight: 1.1 }}>{step.title}</span>
            <span className="ank__small">{stepMeta(step, members, today)}</span>
            <Link to={base + '/anker/' + anchor.id} className="ank__small" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Anker öffnen ›</Link>
          </>
        ) : (
          <span className="hand" style={{ fontSize: 25, color: 'var(--brown)' }}>{anchor.ask_next ? 'Und der nächste Schritt?' : 'Noch kein Schritt festgelegt'}</span>
        )}
      </div>

      {mode === 'note' && (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="textarea-lined" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Was haben wir besprochen?" autoFocus />
          <div className="between">
            <button type="button" className="link" onClick={() => { setMode(null); setNoteText('') }}>abbrechen</button>
            <button type="button" className="link link--hand" onClick={async () => { if (noteText.trim()) await addAnchorLog(anchor.id, 'note', noteText.trim()); setNoteText(''); setMode(null) }}>Eintragen</button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="ank__round">
          <button type="button" className="ank__sunday" disabled={busy} onClick={next}>passt so</button>
          <button type="button" className="ank__sunday" onClick={() => setMode('step')}>Schritt ändern</button>
          <button type="button" className="ank__sunday" onClick={() => setMode('phase')}>Phase ändern</button>
          <button type="button" className="ank__sunday" onClick={() => setMode('note')}>Notiz</button>
        </div>
      )}

      <div className="spacer" />
      <div className="between">
        <span className="hint">{phaseLabel(anchor.phase)}</span>
        <button type="button" className="btn" style={{ width: 'auto', padding: '10px 22px' }} disabled={busy} onClick={next}>
          {pos + 1 < order.length ? 'Weiter →' : area === 'casa' ? 'Weiter zum Essen →' : 'Fertig'}
        </button>
      </div>
    </div>
  )
}

/** Schritte 1, 2, 4 der Casa-Runde und „Fertig“ */
function RundeSchritt({ stage, setStage, anchorsCount }: { stage: Stage; setStage: (s: Stage) => void; anchorsCount: number }) {
  const casa = useCasa()
  const { me, members, people, tasks, events, normalWeek, overrides, slotRequests, milaNextPlan } = casa
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const voice = { me, members }
  const [takeover, setTakeover] = useState<{ date: string; state: DayState; fx: DayEffects } | null>(null)
  const n = STAGES.indexOf(stage) + 1
  const go = (s: Stage) => setStage(s === 'anker' && anchorsCount === 0 ? 'essen' : s)

  // 1 · Geschafft diese Woche (beide), seit letztem Sonntag
  const cutoff = useMemo(() => lastSundayCutoff(now).toISOString(), [now])
  const done = useMemo(() => tasks.filter((t) => t.area === 'casa' && t.status === 'erledigt' && !t.is_skipped && (t.done_at ?? '') >= cutoff).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')), [tasks, cutoff])
  const nameOf = (id: string | null) => (id === me?.id ? 'du' : members.find((m) => m.id === id)?.display_name ?? 'beide')

  // 2 · Die kommende Woche in Klartext (Lücken antippbar)
  const monday = addDays(startOfWeek(today), 7)
  const dates = weekDates(monday)
  const occ = useMemo(() => occurrences(events, monday, dates[6]), [events, monday, dates])
  const rows = dates.map((d) => {
    const dayOcc = occ.filter((o) => o.occ_date <= d && o.occ_end >= d)
    const fx = dayEffects(d, dayOcc, members)
    const state = applyEffects(dayState(d, normalWeek, overrides), fx)
    return { d, fx, state, segs: daySegments(d, state, fx, voice, people, slotRequests), termine: dayOcc.filter((o) => !o.effect || o.effect === 'termin').length }
  })

  // 4 · Essensplan der nächsten Woche
  const p = milaNextPlan
  const essen = !p ? 'Für die nächste Woche gibt es noch keine Wahl.' : p.status === 'wischen' ? 'Die Wahl läuft noch – wer noch nicht gewischt hat, jetzt kurz wischen.' : p.status === 'kombo' ? 'Eure Kombo steht. Übernehmen, dann ist der Einkaufszettel fertig.' : p.adopted_at ? 'Kombo übernommen, der Einkaufszettel steht.' : 'Essensplan ansehen.'

  if (stage === 'fertig') {
    return (
      <div className="page" style={{ gap: 16 }}>
        <Link to="/anker" className="ank__back">‹ Anker</Link>
        <h1 className="h1">Sonntagsrunde</h1>
        <p className="hand hand--navy" style={{ fontSize: 31, lineHeight: 1.15 }}>Fertig – bis nächsten Sonntag.</p>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start', width: 'auto', padding: '10px 22px' }} onClick={() => nav('/heute')}>Zu Heute</button>
      </div>
    )
  }

  return (
    <div className="page runde" style={{ gap: 14 }}>
      <div className="between">
        <Link to="/anker" className="ank__back">‹ Abbrechen</Link>
        <span className="ank__progress">Schritt {n} von 4</span>
      </div>
      <span className="kicker">Sonntagsrunde · 5 Minuten</span>

      {stage === 'geschafft' && (
        <>
          <h1 className="h1" style={{ fontSize: 39 }}>Geschafft diese Woche</h1>
          {done.length === 0 && <p className="hint">Diese Woche ist nichts abgehakt. Auch gut.</p>}
          <div className="stack" style={{ gap: 2 }}>
            {done.slice(0, 12).map((t) => (
              <div className="runde__done" key={t.id}>
                <span className="runde__tick" aria-hidden>✓</span>
                <span className="hand hand--navy" style={{ fontSize: 24, lineHeight: 1.15, flex: 1 }}>{t.title}</span>
                <span className="heute__sub">{nameOf(t.owner_member_id)} · {weekdayShort(toISO(new Date(t.done_at!)))}</span>
              </div>
            ))}
            {done.length > 12 && <span className="hint">+ {done.length - 12} weitere</span>}
          </div>
        </>
      )}

      {stage === 'woche' && (
        <>
          <h1 className="h1" style={{ fontSize: 39 }}>Die kommende Woche</h1>
          <p className="hint">Gestrichelt ist noch offen – antippen und gleich klären.</p>
          <div className="stack" style={{ gap: 0 }}>
            {rows.map((r) => {
              const open = r.segs.some((x) => x.kind === 'open' || x.kind === 'ask')
              return (
                <button type="button" key={r.d} className="runde__day" onClick={() => (open ? setTakeover({ date: r.d, state: r.state, fx: r.fx }) : nav('/woche', { state: { date: r.d } }))}>
                  <span className="wk__wd-name" style={{ width: 34, flex: 'none' }}>{weekdayShort(r.d)}</span>
                  <span className="wk__line" style={{ fontSize: 22 }}>
                    {r.segs.length === 0 && '—'}
                    {r.segs.map((sg, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span className="wk__sep"> · </span>}
                        <span className={'wk__seg-t wk__seg-t--' + sg.kind}>{sg.text}</span>
                      </Fragment>
                    ))}
                    {r.termine > 0 && <span className="wk__terms">{r.termine} {r.termine === 1 ? 'Termin' : 'Termine'}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {stage === 'essen' && (
        <>
          <h1 className="h1" style={{ fontSize: 39 }}>Essensplan</h1>
          <p className="hand hand--navy" style={{ fontSize: 26, lineHeight: 1.2 }}>{essen}</p>
          <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start' }} onClick={() => nav('/mila/wahl')}>Zum Essensplan ›</button>
        </>
      )}

      <div className="spacer" />
      <div className="between">
        {stage === 'geschafft' ? <span /> : <button type="button" className="link" onClick={() => go(STAGES[n - 2])}>‹ zurück</button>}
        <button type="button" className="btn" style={{ width: 'auto', padding: '10px 22px' }} onClick={() => (stage === 'essen' ? setStage('fertig') : go(STAGES[n]))}>
          {stage === 'essen' ? 'Fertig' : stage === 'woche' && anchorsCount ? 'Zu den Ankern →' : 'Weiter →'}
        </button>
      </div>
      {takeover && <Takeover date={takeover.date} state={takeover.state} fx={takeover.fx} onClose={() => setTakeover(null)} />}
    </div>
  )
}
