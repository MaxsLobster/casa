// Medikament · privater Bereich: Heute, Check-in, Übersicht, Einstellungen, dazu „Annas Blick“ für den Partner.
// Keine Bewertungen, keine Streaks: nur die eigenen Werte.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { MedProvider, useMed } from './MedContext'
import { useCasa, useToday } from '../state/HouseholdContext'
import { useSplashGone } from '../state/splash'
import { Toggle } from '../components/ui'
import { SIDE_EFFECTS, SLOTS, SLOT_LABEL, courseLabel, courseOn, courseStats, exportText, fmt, slotTime } from './stats'
import { addDays, fromISO, weekdayLong } from '../lib/dates'
import type { MedSlot } from '../lib/types'
import './med.css'

export function Med() {
  return (
    <MedProvider>
      <MedShell />
    </MedProvider>
  )
}

function MedShell() {
  const splashGone = useSplashGone()
  const { settings, asking } = useMed()
  const mine = !!settings?.enabled
  return (
    <div className="app med">
      <div className="panes">
        <div className="pane">
          <Routes>
            {mine && <Route path="/med" element={<Tag />} />}
            {mine && <Route path="/med/check/:slot" element={<Checkin />} />}
            {mine && <Route path="/med/uebersicht" element={<Uebersicht />} />}
            {mine && <Route path="/med/einstellungen" element={<MedEinstellungen />} />}
            {asking && <Route path="/med/anna" element={<PartnerFrage />} />}
            <Route path="*" element={<Navigate to={mine ? '/med' : '/heute'} replace />} />
          </Routes>
        </div>
      </div>
      {mine && (
        <nav className="nav" aria-label="Medikament">
          <NavLink to="/med" end className="nav__item">Heute</NavLink>
          <NavLink to="/med/uebersicht" className="nav__item">Übersicht</NavLink>
          <NavLink to="/med/einstellungen" className="nav__item">Einstellungen</NavLink>
        </nav>
      )}
      {splashGone && <div className="edge" aria-hidden="true" />}
    </div>
  )
}

function Page({ children }: { children: ReactNode }) {
  const { ready, error } = useMed()
  return (
    <div className="page med__page">
      <div className="med__top">
        <Link to="/heute" className="med__back">‹ Casa</Link>
        <span className="med__brand">Medikament · privat</span>
      </div>
      {error && <p className="hint hint--brown">{error}</p>}
      {ready ? children : <span className="hint">Einen Moment …</span>}
    </div>
  )
}

/** Fünf große Felder 1–5, ein Tipp wählt */
function Scale({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div className="med__scale">
      <span className="med__label">{label}</span>
      <div className="med__dots" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label} ${n}`} className={'med__dot' + (value === n ? ' med__dot--on' : '')} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="med__ends">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const dayTitle = (date: string, today: string) => (date === today ? 'Heute' : date === addDays(today, -1) ? 'Gestern' : `${weekdayLong(date)}, ${fromISO(date).getDate()}.${fromISO(date).getMonth() + 1}.`)

// ---------------------------------------------------------------------------
// Heute / Tagesansicht
// ---------------------------------------------------------------------------

function Tag() {
  const { settings, courses, days, checkins, answers, partner, setTaken, setSleep } = useMed()
  const today = useToday()
  const [offset, setOffset] = useState(0)
  const date = addDays(today, offset)
  const day = days.find((d) => d.date === date)
  const course = courseOn(courses, date)
  const answer = answers.find((a) => a.date === date)
  const list = SLOTS.map((s) => ({ slot: s, c: checkins.find((k) => k.date === date && k.slot === s) }))
  const noMed = !course?.name?.trim()

  return (
    <Page>
      <header className="med__head">
        <button type="button" className="med__arrow" aria-label="Tag davor" onClick={() => setOffset(offset - 1)}>‹</button>
        <div className="med__mid">
          <span className="med__title">{dayTitle(date, today)}</span>
          <span className="med__sub">{courseLabel(course)}</span>
        </div>
        <button type="button" className="med__arrow" aria-label="Tag danach" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</button>
      </header>

      {!noMed &&
        (day?.taken_at ? (
          <div className="med__taken">
            <span className="hand hand--navy">Genommen um</span>
            <input className="input-ui" type="time" value={day.taken_at.slice(0, 5)} onChange={(e) => e.target.value && setTaken(date, e.target.value)} aria-label="Uhrzeit der Einnahme" />
            <button type="button" className="link" onClick={() => setTaken(date, null)}>zurück</button>
          </div>
        ) : (
          <button type="button" className="btn med__big" onClick={() => setTaken(date, date === today ? hhmm() : (settings?.t_morning ?? '07:30').slice(0, 5))}>Genommen</button>
        ))}

      <Scale label="Schlaf letzte Nacht" value={day?.sleep ?? null} onChange={(v) => setSleep(date, v)} low="schlecht" high="sehr gut" />

      <section className="med__list">
        <span className="med__label">Check-ins</span>
        {list.map(({ slot, c }) => (
          <Link key={slot} to={`/med/check/${slot}${offset ? `?d=${date}` : ''}`} className="med__row">
            <span className="med__time">{slotTime(settings, slot)}</span>
            {c ? (
              <span className="med__vals">
                <span>Fokus <b>{c.focus ?? '–'}</b></span>
                <span>Ruhe <b>{c.calm ?? '–'}</b></span>
                <span>Stimmung <b>{c.mood ?? '–'}</b></span>
              </span>
            ) : (
              <span className="med__open">{SLOT_LABEL[slot]} · eintragen</span>
            )}
            <span className="med__chev" aria-hidden>›</span>
          </Link>
        ))}
      </section>

      {list.some((x) => x.c) && <Verlauf date={date} />}

      {list.some((x) => x.c?.note?.trim() || (x.c?.side_effects?.length ?? 0) > 0 || x.c?.appetite) || answer ? (
        <section className="med__list">
          <span className="med__label">Dazu</span>
          {list.map(({ slot, c }) => (c?.note?.trim() ? <p key={slot} className="med__note"><span className="med__time">{slotTime(settings, slot)}</span>{c.note}</p> : null))}
          {list[2].c?.appetite ? <p className="med__note"><span className="med__time">Appetit</span>{list[2].c.appetite} von 5</p> : null}
          {(list[2].c?.side_effects?.length ?? 0) > 0 && <p className="med__note"><span className="med__time">Neben­wirkungen</span>{list[2].c!.side_effects.join(', ')}</p>}
          {answer && (
            <p className="med__note">
              <span className="med__time">{partner?.display_name ?? 'Partner'}</span>
              Abend {answer.value} von 5{answer.note?.trim() ? ` · ${answer.note}` : ''}
            </p>
          )}
        </section>
      ) : null}
    </Page>
  )
}

/** Verlauf der drei Werte über den Tag, Einnahmezeit markiert */
function Verlauf({ date }: { date: string }) {
  const { settings, days, checkins } = useMed()
  const W = 320
  const H = 130
  const L = 22
  const T = 10
  const B = 22
  const x = (t: string) => L + ((Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 - 6) / 17) * (W - L - 8)
  const y = (v: number) => T + ((5 - v) / 4) * (H - T - B)
  const pts = SLOTS.map((s) => ({ t: slotTime(settings, s), c: checkins.find((k) => k.date === date && k.slot === s) })).filter((p) => p.c)
  const taken = days.find((d) => d.date === date)?.taken_at
  const series: { key: 'focus' | 'calm' | 'mood'; label: string; cls: string }[] = [
    { key: 'focus', label: 'Fokus', cls: 'med__line--a' },
    { key: 'calm', label: 'Ruhe im Kopf', cls: 'med__line--b' },
    { key: 'mood', label: 'Stimmung', cls: 'med__line--c' },
  ]
  return (
    <section className="med__list">
      <span className="med__label">Verlauf</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="med__chart" role="img" aria-label="Verlauf von Fokus, Ruhe und Stimmung über den Tag">
        {[1, 3, 5].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} className="med__grid" />
            <text x={4} y={y(v) + 4} className="med__axis">{v}</text>
          </g>
        ))}
        {[8, 12, 16, 20].map((h) => (
          <text key={h} x={x(`${String(h).padStart(2, '0')}:00`)} y={H - 6} textAnchor="middle" className="med__axis">{h}</text>
        ))}
        {taken && (
          <g>
            <line x1={x(taken)} x2={x(taken)} y1={T} y2={H - B} className="med__takenline" />
            <text x={x(taken) > W - 70 ? x(taken) - 4 : x(taken) + 4} y={T + 8} textAnchor={x(taken) > W - 70 ? 'end' : 'start'} className="med__axis">genommen</text>
          </g>
        )}
        {series.map((s) => {
          const p = pts.filter((q) => typeof q.c![s.key] === 'number')
          return (
            <g key={s.key} className={s.cls}>
              {p.length > 1 && <polyline points={p.map((q) => `${x(q.t)},${y(q.c![s.key] as number)}`).join(' ')} fill="none" />}
              {p.map((q) => (
                <circle key={q.t} cx={x(q.t)} cy={y(q.c![s.key] as number)} r={4} />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="med__legend">
        {series.map((s) => (
          <span key={s.key} className={s.cls}><i />{s.label}</span>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

function Checkin() {
  const { slot: raw } = useParams()
  const nav = useNavigate()
  const today = useToday()
  const { checkins, saveCheckin, settings } = useMed()
  const slot = (Number(raw) === 2 ? 2 : Number(raw) === 3 ? 3 : 1) as MedSlot
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('d')
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today
  const c = checkins.find((k) => k.date === date && k.slot === slot)
  const [note, setNote] = useState(c?.note ?? '')
  useEffect(() => {
    setNote(c?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id])
  const fx = c?.side_effects ?? []
  const toggleFx = (name: string) => {
    let next: string[]
    if (name === 'keine') next = fx.includes('keine') ? [] : ['keine']
    else next = fx.includes(name) ? fx.filter((x) => x !== name) : [...fx.filter((x) => x !== 'keine'), name]
    saveCheckin(date, slot, { side_effects: next })
  }
  async function done() {
    if ((c?.note ?? '') !== note.trim()) await saveCheckin(date, slot, { note: note.trim() || null })
    nav('/med')
  }
  return (
    <Page>
      <header className="med__head">
        <div className="med__mid" style={{ alignItems: 'flex-start' }}>
          <span className="med__title">{SLOT_LABEL[slot]}</span>
          <span className="med__sub">{dayTitle(date, today)} · {slotTime(settings, slot)} Uhr</span>
        </div>
      </header>
      <Scale label="Fokus" value={c?.focus ?? null} onChange={(v) => saveCheckin(date, slot, { focus: v })} low="zerstreut" high="klar" />
      <Scale label="Ruhe im Kopf" value={c?.calm ?? null} onChange={(v) => saveCheckin(date, slot, { calm: v })} low="laut" high="ruhig" />
      <Scale label="Stimmung" value={c?.mood ?? null} onChange={(v) => saveCheckin(date, slot, { mood: v })} low="gedrückt" high="gut" />
      {slot === 3 && (
        <>
          <Scale label="Appetit heute" value={c?.appetite ?? null} onChange={(v) => saveCheckin(date, slot, { appetite: v })} low="kaum" high="normal" />
          <div className="med__scale">
            <span className="med__label">Nebenwirkungen</span>
            <div className="med__chips">
              {SIDE_EFFECTS.map((n) => (
                <button key={n} type="button" aria-pressed={fx.includes(n)} className={'med__chip' + (fx.includes(n) ? ' med__chip--on' : '')} onClick={() => toggleFx(n)}>{n}</button>
              ))}
            </div>
          </div>
        </>
      )}
      <textarea className="input-ui med__text" rows={2} placeholder="Notiz, wenn du magst" aria-label="Notiz" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn" onClick={done}>Fertig</button>
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------

function Uebersicht() {
  const { courses, days, checkins, answers, partner } = useMed()
  const [copied, setCopied] = useState(false)
  const stats = courseStats(courses, days, checkins, answers)
  const pn = partner?.display_name ?? 'Partner'
  const text = exportText(stats, checkins, answers, pn)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Page>
      <header className="med__head">
        <div className="med__mid" style={{ alignItems: 'flex-start' }}>
          <span className="med__title">Übersicht</span>
          <span className="med__sub">Durchschnitt je Medikament und Dosis</span>
        </div>
      </header>
      {stats.length === 0 && <p className="hint">Noch kein Medikament eingetragen.</p>}
      {stats.map((s) => (
        <section key={s.course?.id ?? s.from} className="med__card">
          <span className="hand hand--navy" style={{ fontSize: 26, lineHeight: 1.05 }}>{courseLabel(s.course)}</span>
          <span className="med__sub">
            seit {fromISO(s.from).getDate()}.{fromISO(s.from).getMonth() + 1}.{s.to ? ` bis ${fromISO(s.to).getDate()}.${fromISO(s.to).getMonth() + 1}.` : ''} · {s.days} {s.days === 1 ? 'Tag' : 'Tage'} mit Einträgen
          </span>
          {s.days === 0 ? (
            <p className="hint">Noch keine Einträge.</p>
          ) : (
            <>
              <table className="med__table">
                <thead>
                  <tr><th /><th>Fokus</th><th>Ruhe</th><th>Stimmung</th></tr>
                </thead>
                <tbody>
                  {SLOTS.map((k) => (
                    <tr key={k}>
                      <th>{SLOT_LABEL[k]}<small>{s.slots[k].n}×</small></th>
                      <td>{fmt(s.slots[k].focus)}</td>
                      <td>{fmt(s.slots[k].calm)}</td>
                      <td>{fmt(s.slots[k].mood)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="med__facts">
                <span>Schlaf <b>{fmt(s.sleep)}</b></span>
                <span>Appetit <b>{fmt(s.appetite)}</b></span>
                {s.partnerDays > 0 && <span>{pn} <b>{fmt(s.partner)}</b> <small>{s.partnerDays}×</small></span>}
                {s.taken && <span>Einnahme ⌀ <b>{s.taken}</b></span>}
              </div>
              {s.sideEffects.length > 0 && <span className="med__sub" style={{ textTransform: 'none', letterSpacing: 0 }}>Nebenwirkungen: {s.sideEffects.map((e) => `${e.name} ${e.n}×`).join(', ')}</span>}
            </>
          )}
        </section>
      ))}
      {stats.length > 0 && (
        <>
          <button type="button" className="btn btn--ghost" onClick={copy}>{copied ? 'Kopiert' : 'Als Text kopieren'}</button>
          <textarea className="input-ui med__export" readOnly value={text} rows={8} aria-label="Text für die Ärztin" onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Einstellungen im Bereich
// ---------------------------------------------------------------------------

function MedEinstellungen() {
  const { settings, courses, addCourse, removeCourse, partner } = useMed()
  const casa = useCasa()
  const today = useToday()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [start, setStart] = useState(today)
  const [open, setOpen] = useState(false)
  if (!settings) return null
  const current = courseOn(courses, today)
  const t5 = (t: string) => t.slice(0, 5)
  const pn = partner?.display_name ?? 'Partner'
  async function add(none: boolean) {
    await addCourse({ name: none ? null : name.trim() || null, dose: none ? null : dose.trim() || null, start_date: start })
    setName('')
    setDose('')
    setOpen(false)
  }
  const times: { key: 't_morning' | 't_1' | 't_2' | 't_3'; label: string }[] = [
    { key: 't_morning', label: 'Morgens (genommen?)' },
    { key: 't_1', label: 'Check-in 1' },
    { key: 't_2', label: 'Check-in 2' },
    { key: 't_3', label: 'Check-in 3 (Abend)' },
  ]
  return (
    <Page>
      <header className="med__head">
        <div className="med__mid" style={{ alignItems: 'flex-start' }}>
          <span className="med__title">Einstellungen</span>
        </div>
      </header>

      <section className="med__list">
        <span className="med__label">Aktuell</span>
        <span className="hand hand--navy" style={{ fontSize: 26 }}>{courseLabel(current)}</span>
        {!open ? (
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Wechsel eintragen</button>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            <input className="input-ui" placeholder="Medikament" aria-label="Medikament" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="between" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <input className="input-ui" placeholder="Dosis, z. B. 30 mg" aria-label="Dosis" value={dose} onChange={(e) => setDose(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
              <input className="input-ui" type="date" aria-label="Ab wann" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </div>
            <div className="between" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <button type="button" className="btn" style={{ width: 'auto', padding: '0 22px', height: 46 }} disabled={!name.trim()} onClick={() => add(false)}>Speichern</button>
              <button type="button" className="link" onClick={() => add(true)}>Kein Medikament ab diesem Tag</button>
              <button type="button" className="link" onClick={() => setOpen(false)}>Abbrechen</button>
            </div>
          </div>
        )}
        {courses.length > 0 && (
          <div className="stack" style={{ gap: 0, marginTop: 6 }}>
            <span className="med__label">Verlauf</span>
            {[...courses].reverse().map((c) => (
              <div key={c.id} className="med__course">
                <span>{courseLabel(c)}</span>
                <span className="med__sub" style={{ marginLeft: 'auto' }}>ab {fromISO(c.start_date).getDate()}.{fromISO(c.start_date).getMonth() + 1}.{fromISO(c.start_date).getFullYear()}</span>
                {courses.length > 1 && <button type="button" className="med__x" aria-label={`${courseLabel(c)} entfernen`} onClick={() => removeCourse(c.id)}>×</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="med__list">
        <span className="med__label">Erinnerungen</span>
        {times.map((t) => (
          <div key={t.key} className="between" style={{ gap: 10 }}>
            <span className="hint">{t.label}</span>
            <input className="input-ui" type="time" value={t5(settings[t.key])} onChange={(e) => e.target.value && casa.updateMed({ [t.key]: e.target.value })} aria-label={t.label} style={{ minWidth: 120 }} />
          </div>
        ))}
        <p className="hint">Nur wenn Mitteilungen in Casa an sind. Deine Ruhezeit gilt. Was du verpasst, bleibt einfach leer.</p>
      </section>

      <section className="med__list">
        <Toggle on={settings.ask_partner} onChange={(v) => casa.updateMed({ ask_partner: v })} label={`${pn} fragen`} hint={`${pn} bekommt abends eine einzige Frage: „Wie war ${casa.me?.display_name ?? 'ich'} heute Abend?“ Nur wenn ${pn} dem in den eigenen Einstellungen zustimmt. ${pn} sieht weder deine Werte noch das Medikament.`} />
        {settings.ask_partner && (
          <div className="between" style={{ gap: 10 }}>
            <span className="hint">Uhrzeit der Frage</span>
            <input className="input-ui" type="time" value={t5(settings.t_partner)} onChange={(e) => e.target.value && casa.updateMed({ t_partner: e.target.value })} aria-label="Uhrzeit der Frage" style={{ minWidth: 120 }} />
          </div>
        )}
      </section>
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Annas Blick: genau eine Frage
// ---------------------------------------------------------------------------

function PartnerFrage() {
  const { asking, myAnswers, saveAnswer } = useMed()
  const casa = useCasa()
  const today = useToday()
  const nav = useNavigate()
  const who = casa.members.find((m) => m.id === asking)?.display_name ?? ''
  const mine = myAnswers.find((a) => a.date === today && a.about_member_id === asking)
  const [note, setNote] = useState(mine?.note ?? '')
  const [value, setValue] = useState<number | null>(mine?.value ?? null)
  useEffect(() => {
    if (mine) {
      setValue(mine.value)
      setNote(mine.note ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id])
  async function done() {
    if (value) await saveAnswer(today, value, note.trim() || null)
    nav('/heute')
  }
  return (
    <div className="page med__page">
      <div className="med__top">
        <Link to="/heute" className="med__back">‹ Casa</Link>
      </div>
      <header className="med__head">
        <div className="med__mid" style={{ alignItems: 'flex-start' }}>
          <span className="med__title">Wie war {who} heute Abend?</span>
        </div>
      </header>
      <Scale label="Dein Eindruck" value={value} onChange={setValue} low="angespannt" high="entspannt" />
      <textarea className="input-ui med__text" rows={2} placeholder="Notiz, wenn du magst" aria-label="Notiz" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn" disabled={!value} onClick={done}>Fertig</button>
      <p className="hint">Du siehst hier nur deine eigene Antwort. Abschalten kannst du die Frage jederzeit in deinen Einstellungen.</p>
    </div>
  )
}
