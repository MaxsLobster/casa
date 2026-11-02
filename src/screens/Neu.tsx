import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { Chips, HandInput, MicButton, Tabs } from '../components/ui'
import { WhenPicker } from './WhenPicker'
import { RepeatPicker } from './RepeatPicker'
import type { Repeat } from '../lib/types'
import { addDays } from '../lib/dates'
import { EffectChips, EMPTY_HANDOVER, HandoverFields, parseEffect, type EffectChoice, type Handover } from './EffectPicker'
import { defaultTitle } from '../lib/effects'
import { useArea } from '../state/area'

type Kind = 'aufgabe' | 'termin' | 'idee'

export function Neu() {
  const casa = useCasa()
  const nav = useNavigate()
  const loc = useLocation()
  const today = useToday()
  const area = useArea()
  const preset = (loc.state ?? {}) as { kind?: Kind; date?: string; anchor?: string; title?: string; idea?: string; yearly?: boolean }

  const [kind, setKind] = useState<Kind>(preset.kind ?? 'aufgabe')
  const [title, setTitle] = useState(preset.title ?? '')
  const [who, setWho] = useState<string | null>(null) // member id | 'beide' | 'p:<person id>' | 'offen' (Aufgabe ohne Besitzer)
  const [anchor, setAnchor] = useState<string>(preset.anchor ?? 'keiner')
  const anchorOptions = casa.anchors.filter((a) => !a.archived_at && a.area === area)
  const [when, setWhen] = useState<string | null>(preset.date ?? null)
  const [time, setTime] = useState('')
  const [multi, setMulti] = useState(false)
  const [until, setUntil] = useState('')
  const [repeat, setRepeat] = useState<Repeat | null>(null)
  const [effectChoice, setEffectChoice] = useState<EffectChoice>('termin')
  const [handover, setHandover] = useState<Handover>(EMPTY_HANDOVER)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const partners = casa.members.filter((m) => m.role === 'partner')
  const fx = kind === 'termin' ? parseEffect(effectChoice) : parseEffect('termin')
  const people =
    kind === 'termin'
      ? fx.effect === 'valerie_weg'
        ? casa.people.map((p) => ({ value: 'p:' + p.id, label: p.name }))
        : [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'beide', label: 'Beide' }, ...casa.people.map((p) => ({ value: 'p:' + p.id, label: p.name }))]
      : [...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'offen', label: 'Offen' }]
  // Bei „Kita zu" und „Max/Anna ist weg" gibt es keine Frage „Wer?"; bei „Valerie ist weg" ist die Person optional
  const askWho = fx.effect === 'termin' || fx.effect === 'valerie_weg'
  const needWho = fx.effect === 'termin'
  const autoTitle = defaultTitle(fx.effect, who?.startsWith('p:') ? (casa.people.find((p) => 'p:' + p.id === who)?.name ?? null) : null, fx.member_id ? (partners.find((m) => m.id === fx.member_id)?.display_name ?? null) : null)
  const finalTitle = title.trim() || autoTitle

  const ready = kind === 'idee' ? title.trim().length > 0 : finalTitle.length > 0 && (!needWho || !!who) && !!when && (!multi || (!!until && until >= when))
  const missing = needWho && !who && !when ? 'Wer und wann fehlen noch' : needWho && !who ? 'Wer fehlt noch' : !when ? 'Wann fehlt noch' : multi && (!until || until < (when ?? '')) ? 'Bis wann fehlt noch' : 'Was fehlt noch'

  function pickKind(k: Kind) {
    setKind(k)
    if (k === 'idee') return
    if (k === 'aufgabe' && (who === 'beide' || who?.startsWith('p:'))) setWho(null)
    if (k === 'termin' && who === 'offen') setWho(null)
    if (k === 'aufgabe') setMulti(false)
  }

  function pickEffect(c: EffectChoice) {
    setEffectChoice(c)
    const e = parseEffect(c)
    if (e.effect === 'valerie_weg' && who && !who.startsWith('p:')) setWho(null)
    if (e.effect !== 'termin' && e.effect !== 'valerie_weg') setWho(null)
    if (e.effect !== 'termin' && !multi) {
      setMulti(true)
      setUntil(when ? addDays(when, 1) : '')
    }
  }

  function back() {
    if (window.history.length > 1) nav(-1)
    else nav('/heute')
  }

  async function save() {
    if (!ready) return
    if (kind === 'idee') {
      setBusy(true)
      setError(null)
      try {
        await casa.addIdea(title.trim(), area)
        back()
      } catch (err) {
        setError('Konnte nicht speichern: ' + (err as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }
    if (!when || (needWho && !who)) return
    setBusy(true)
    setError(null)
    try {
      if (kind === 'aufgabe') {
        if (!who) return
        await casa.addTask({ title: title.trim(), owner_member_id: who === 'offen' ? null : who, due_date: when, repeat, anchor_id: anchor === 'keiner' ? null : anchor, area, is_yearly: !!preset.yearly })
        if (preset.idea) await casa.removeIdea(preset.idea)
      } else {
        const w = who ?? ''
        await casa.addEvent({
          title: finalTitle,
          date: when,
          end_date: multi && until > when ? until : null,
          member_id: fx.effect === 'eltern_weg' ? fx.member_id : w === 'beide' || w.startsWith('p:') || !w ? null : w,
          person_id: w.startsWith('p:') ? w.slice(2) : null,
          start_time: multi ? null : time || null,
          repeat,
          effect: fx.effect,
          dropoff_by: fx.effect === 'valerie_weg' ? handover.dropoff_by : null,
          dropoff_at: fx.effect === 'valerie_weg' && handover.dropoff_by ? handover.dropoff_at || null : null,
          pickup_by: fx.effect === 'valerie_weg' ? handover.pickup_by : null,
          pickup_at: fx.effect === 'valerie_weg' && handover.pickup_by ? handover.pickup_at || null : null,
        })
      }
      back()
    } catch (err) {
      setError('Konnte nicht speichern: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay">
      <div className="page">
        <div className="between">
          <h1 className="h1">Neu notieren</h1>
          <button type="button" className="link" onClick={back}>Abbrechen</button>
        </div>

        <Tabs
          tabs={[
            { value: 'aufgabe' as Kind, label: 'Aufgabe' },
            ...(area === 'mwf' ? [{ value: 'idee' as Kind, label: 'Idee' }] : []),
            { value: 'termin' as Kind, label: 'Termin' },
          ]}
          value={kind}
          onChange={pickKind}
        />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HandInput value={title} onChange={setTitle} placeholder={kind === 'aufgabe' ? 'Was ist zu tun?' : kind === 'idee' ? 'Was ist die Idee?' : autoTitle || 'Was steht an?'} inputRef={inputRef} autoFocus />
          </div>
          <MicButton target={inputRef} />
        </div>

        {area === 'mwf' && kind !== 'idee' && <span className="hint"><span className="mwf__tag" style={{ marginRight: 6 }}>MWF</span>{kind === 'aufgabe' ? (preset.yearly ? 'Punkt der Jahres-Checkliste.' : 'Aufgabe der Firma. In Casa nur sichtbar, wenn der Arbeitstag an ist.') : 'Termine stehen immer in der Casa-Woche.'}</span>}
        {kind === 'idee' && <span className="hint">Ohne Besitzer, ohne Datum. Später zur Aufgabe oder zum Anker machen.</span>}

        {kind === 'termin' && <EffectChips value={effectChoice} onChange={pickEffect} partners={partners} />}

        {(kind === 'aufgabe' || (kind === 'termin' && askWho)) && (
          <div className="stack">
            <span className="label">{kind === 'aufgabe' ? 'Wer kümmert sich?' : fx.effect === 'valerie_weg' ? 'Bei wem?' : 'Wer?'}</span>
            <Chips options={people} value={who} onChange={setWho} />
            {kind === 'aufgabe' && who === 'offen' && <span className="hint">Noch niemand – beide sehen sie, einer übernimmt. Der andere bekommt eine Mitteilung.</span>}
          </div>
        )}

        {kind === 'aufgabe' && anchorOptions.length > 0 && (
          <div className="stack">
            <span className="label">Anker</span>
            <Chips variant="date" options={[{ value: 'keiner', label: 'keiner' }, ...anchorOptions.map((a) => ({ value: a.id, label: '⚓︎ ' + a.title }))]} value={anchor} onChange={setAnchor} />
          </div>
        )}

        {kind !== 'idee' && (
        <div className="stack">
          <span className="label">{kind === 'aufgabe' ? 'Bis wann?' : multi ? 'Von wann?' : 'Wann?'}</span>
          <WhenPicker kind={kind} value={when} onChange={(d) => { setWhen(d); if (multi && !until && d) setUntil(addDays(d, 1)) }} today={today} />
          {kind === 'termin' && !multi && (
            <div className="stack stack--tight" style={{ marginTop: 6 }}>
              <label className="label label--small" htmlFor="neu-time">Uhrzeit (optional)</label>
              <input id="neu-time" className="input-ui" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
            </div>
          )}
          {kind === 'termin' && (
            <div className="stack stack--tight" style={{ marginTop: 6 }}>
              {!multi ? (
                <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', padding: '2px 0' }} onClick={() => { setMulti(true); setUntil(when ? addDays(when, 1) : '') }}>
                  + mehrere Tage (z. B. Valerie bei Oma So–Di)
                </button>
              ) : (
                <>
                  <label className="label label--small" htmlFor="neu-until">Bis wann?</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input id="neu-until" className="input-ui" type="date" value={until} min={when ?? undefined} onChange={(e) => setUntil(e.target.value)} style={{ minWidth: 180 }} />
                    <button type="button" className="link" onClick={() => setMulti(false)}>nur ein Tag</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        )}

        {kind === 'termin' && fx.effect === 'valerie_weg' && <HandoverFields value={handover} onChange={setHandover} me={casa.me} members={casa.members} people={casa.people} />}

        {kind !== 'idee' && (
          <div className="stack">
            <span className="label">Wiederholen?</span>
            <RepeatPicker value={repeat} onChange={setRepeat} />
          </div>
        )}

        {error && <p className="hint hint--brown">{error}</p>}

        <div className="spacer" />

        <button type="button" className="btn" disabled={!ready || busy} onClick={save}>
          {busy ? 'Einen Moment …' : ready ? 'Notieren' : kind === 'idee' ? 'Was fehlt noch' : missing}
        </button>
      </div>
    </div>
  )
}
