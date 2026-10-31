// Mila · Rezept-Formular: neu anlegen oder bestehendes bearbeiten
import { useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MilaTop } from './Mila'
import { useMila, type IngredientInput, type StepInput } from './MilaContext'
import { CATEGORIES, CATEGORY_LABELS, DEVICES, DEVICE_LABELS } from './portions'
import { formatNumber } from './shopping'
import { Toggle } from '../components/ui'
import type { MilaCategory } from '../lib/types'

interface IngRow { key: string; id?: string; amount: string; unit: string; name: string; pantry_basic: boolean }
interface StepRow {
  key: string
  title: string
  text: string
  timer_min: string
  is_thermomix: boolean
  tm_min: string
  tm_sek: string
  tm_temp: string
  tm_speed: string
  tm_reverse: boolean
  ingredient_keys: string[]
}

/** Textfeld, das mit dem Inhalt wächst */
function AutoArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 2 + 'px'
  }, [props.value])
  return <textarea ref={ref} rows={2} {...props} />
}

const newIng = (): IngRow => ({ key: crypto.randomUUID(), amount: '', unit: '', name: '', pantry_basic: false })
const newStep = (): StepRow => ({ key: crypto.randomUUID(), title: '', text: '', timer_min: '', is_thermomix: false, tm_min: '', tm_sek: '', tm_temp: '', tm_speed: '', tm_reverse: false, ingredient_keys: [] })

/** „1/2“, „½“, „1,5“ → Zahl; leer → null */
function parseNum(s: string): number | null {
  const t = s.trim().replace('½', '0.5').replace('¼', '0.25').replace('¾', '0.75').replace(',', '.')
  if (!t) return null
  const frac = t.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = parseFloat(t)
  return Number.isNaN(n) ? null : n
}

export function RezeptForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const { recipeById, ingredientsOf, stepsOf, saveRecipe, ready } = useMila()
  const existing = recipeById(id)

  const init = useMemo(() => {
    if (!existing) return null
    const ings: IngRow[] = ingredientsOf(existing.id).map((i) => ({ key: i.id, id: i.id, amount: i.amount === null ? '' : formatNumber(Number(i.amount)), unit: i.unit, name: i.name, pantry_basic: i.pantry_basic }))
    const steps: StepRow[] = stepsOf(existing.id).map((s) => ({
      key: s.id,
      title: s.title ?? '',
      text: s.text,
      timer_min: s.timer_sec ? String(Math.round(s.timer_sec / 60)) : '',
      is_thermomix: s.is_thermomix,
      tm_min: s.tm_time_sec ? String(Math.floor(s.tm_time_sec / 60)) : '',
      tm_sek: s.tm_time_sec ? String(s.tm_time_sec % 60) : '',
      tm_temp: s.tm_temp ?? '',
      tm_speed: s.tm_speed ?? '',
      tm_reverse: s.tm_reverse,
      ingredient_keys: s.ingredient_ids,
    }))
    return { ings, steps }
    // nur beim ersten Aufbau
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  const [name, setName] = useState(existing?.name ?? '')
  const [time, setTime] = useState(existing?.time_min ? String(existing.time_min) : '')
  const [portions, setPortions] = useState(String(existing?.portions ?? 3))
  const [category, setCategory] = useState<MilaCategory>(existing?.category ?? 'schnell')
  const [devices, setDevices] = useState<string[]>(existing?.devices ?? [])
  const [valerie, setValerie] = useState(existing?.valerie_tauglich ?? false)
  const [valerieNote, setValerieNote] = useState(existing?.valerie_note ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [ings, setIngs] = useState<IngRow[]>(init?.ings.length ? init.ings : [newIng()])
  const [steps, setSteps] = useState<StepRow[]>(init?.steps.length ? init.steps : [newStep()])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!ready) return <div className="page"><MilaTop /><span className="hint">Einen Moment …</span></div>
  if (id && !existing) return <div className="page"><MilaTop /><p className="m-hint">Dieses Gericht gibt es nicht mehr.</p></div>

  const back = existing ? `/mila/gerichte/${existing.id}` : '/mila/gerichte'
  const setIng = (key: string, patch: Partial<IngRow>) => setIngs((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const setStep = (key: string, patch: Partial<StepRow>) => setSteps((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  async function save() {
    if (!name.trim()) {
      setErr('Ein Name fehlt noch.')
      return
    }
    setBusy(true)
    setErr(null)
    const ingRows = ings.filter((i) => i.name.trim())
    // Jede Zutat bekommt ihre feste ID, damit die Schritte sie kennen
    const idOf = new Map(ingRows.map((i) => [i.key, i.id ?? crypto.randomUUID()]))
    const ingInput: IngredientInput[] = ingRows.map((i) => ({ id: idOf.get(i.key), name: i.name, amount: parseNum(i.amount), unit: i.unit, pantry_basic: i.pantry_basic }))
    const stepInput: StepInput[] = steps
      .filter((s) => s.text.trim() || s.is_thermomix)
      .map((s) => {
        const tmSec = (parseNum(s.tm_min) ?? 0) * 60 + (parseNum(s.tm_sek) ?? 0)
        const timer = parseNum(s.timer_min)
        return {
          title: s.title.trim() || null,
          text: s.text.trim(),
          timer_sec: !s.is_thermomix && timer ? Math.round(timer * 60) : null,
          is_thermomix: s.is_thermomix,
          tm_time_sec: s.is_thermomix && tmSec > 0 ? Math.round(tmSec) : null,
          tm_temp: s.is_thermomix ? s.tm_temp.trim() : null,
          tm_speed: s.is_thermomix ? s.tm_speed.trim() : null,
          tm_reverse: s.is_thermomix && s.tm_reverse,
          ingredient_ids: s.ingredient_keys.map((k) => idOf.get(k)).filter((x): x is string => !!x),
        }
      })
    try {
      const rid = await saveRecipe(
        { name: name.trim(), category, time_min: parseNum(time) ? Math.round(parseNum(time)!) : null, portions: Math.max(1, Math.round(parseNum(portions) ?? 1)), valerie_tauglich: valerie, devices, notes: notes.trim() || null, valerie_note: valerieNote.trim() || null },
        ingInput,
        stepInput,
        existing?.id,
      )
      nav(`/mila/gerichte/${rid}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="page m-form">
      <MilaTop />
      <Link to={back} className="m-back" style={{ alignSelf: 'flex-start' }}>‹ {existing ? 'Zurück' : 'Gerichte'}</Link>
      <span className="m-title" style={{ fontSize: 36 }}>{existing ? 'Rezept bearbeiten' : 'Neues Rezept'}</span>

      <label className="m-field">
        <span className="m-group__label">Name</span>
        <input className="m-input m-input--hand" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Shakshuka" autoFocus={!existing} />
      </label>

      <div className="m-two">
        <label className="m-field">
          <span className="m-group__label">Dauer (Min)</span>
          <input className="m-input" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="25" />
        </label>
        <label className="m-field">
          <span className="m-group__label">Portionen</span>
          <input className="m-input" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
        </label>
      </div>

      <div className="m-field">
        <span className="m-group__label">Kategorie</span>
        <div className="m-chips" role="radiogroup">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c} className={'m-chip' + (category === c ? ' m-chip--on' : '')} onClick={() => setCategory(c)}>{CATEGORY_LABELS[c]}</button>
          ))}
        </div>
      </div>

      <div className="m-field">
        <span className="m-group__label">Geräte</span>
        <div className="m-chips">
          {DEVICES.map((d) => {
            const on = devices.includes(d)
            return (
              <button key={d} type="button" aria-pressed={on} className={'m-chip' + (on ? ' m-chip--on' : '')} onClick={() => setDevices(on ? devices.filter((x) => x !== d) : [...devices, d])}>{DEVICE_LABELS[d]}</button>
            )
          })}
        </div>
      </div>

      <Toggle on={valerie} onChange={setValerie} label="Valerie-tauglich" />
      <label className="m-field">
        <span className="m-group__label">Für Valerie</span>
        <AutoArea className="m-input m-textarea" value={valerieNote} onChange={(e) => setValerieNote(e.target.value)} placeholder="z. B. vor dem Pfeffer einen Schöpfer abnehmen" />
      </label>

      {/* ---------- Zutaten ---------- */}
      <section className="m-field">
        <span className="m-group__label">Zutaten</span>
        <span className="m-hint" style={{ fontSize: 12 }}>Menge · Einheit · Name. „Basis“ heißt: ist immer da, kommt nicht auf die Einkaufsliste.</span>
        {ings.map((i) => (
          <div key={i.key} className="m-ingrow">
            <input className="m-input m-input--xs" value={i.amount} onChange={(e) => setIng(i.key, { amount: e.target.value })} placeholder="500" aria-label="Menge" inputMode="decimal" />
            <input className="m-input m-input--s" value={i.unit} onChange={(e) => setIng(i.key, { unit: e.target.value })} placeholder="g" aria-label="Einheit" />
            <input className="m-input m-input--hand" value={i.name} onChange={(e) => setIng(i.key, { name: e.target.value })} placeholder="Zutat" aria-label="Zutat" />
            <button type="button" className={'m-mini' + (i.pantry_basic ? ' m-mini--on' : '')} aria-pressed={i.pantry_basic} onClick={() => setIng(i.key, { pantry_basic: !i.pantry_basic })}>Basis</button>
            <button type="button" className="m-x" aria-label="Zutat entfernen" onClick={() => setIngs((xs) => xs.filter((x) => x.key !== i.key))}>×</button>
          </div>
        ))}
        <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setIngs((xs) => [...xs, newIng()])}>+ Zutat</button>
      </section>

      {/* ---------- Schritte ---------- */}
      <section className="m-field">
        <span className="m-group__label">Schritte</span>
        {steps.map((s, k) => (
          <div key={s.key} className="m-steprow">
            <div className="between">
              <span className="hand hand--brown" style={{ fontSize: 24, lineHeight: 1 }}>{k + 1}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="button" className={'m-mini' + (s.is_thermomix ? ' m-mini--on' : '')} aria-pressed={s.is_thermomix} onClick={() => setStep(s.key, { is_thermomix: !s.is_thermomix })}>Thermomix</button>
                <button type="button" className="m-x" aria-label="Schritt entfernen" onClick={() => setSteps((xs) => xs.filter((x) => x.key !== s.key))}>×</button>
              </span>
            </div>
            {s.is_thermomix && <input className="m-input" value={s.title} onChange={(e) => setStep(s.key, { title: e.target.value })} placeholder="Titel, z. B. Andünsten" aria-label="Titel" />}
            <AutoArea className="m-input m-textarea" value={s.text} onChange={(e) => setStep(s.key, { text: e.target.value })} placeholder={s.is_thermomix ? 'Was in den Mixtopf kommt' : 'Was zu tun ist'} aria-label="Schritttext" />
            {s.is_thermomix ? (
              <div className="m-tmfields">
                <label className="m-field"><span className="m-group__label">Min</span><input className="m-input" inputMode="numeric" value={s.tm_min} onChange={(e) => setStep(s.key, { tm_min: e.target.value })} placeholder="5" /></label>
                <label className="m-field"><span className="m-group__label">Sek</span><input className="m-input" inputMode="numeric" value={s.tm_sek} onChange={(e) => setStep(s.key, { tm_sek: e.target.value })} placeholder="0" /></label>
                <label className="m-field"><span className="m-group__label">Temp.</span><input className="m-input" value={s.tm_temp} onChange={(e) => setStep(s.key, { tm_temp: e.target.value })} placeholder="120 / Varoma" /></label>
                <label className="m-field"><span className="m-group__label">Stufe</span><input className="m-input" value={s.tm_speed} onChange={(e) => setStep(s.key, { tm_speed: e.target.value })} placeholder="1 / Löffel" /></label>
                <button type="button" className={'m-mini' + (s.tm_reverse ? ' m-mini--on' : '')} aria-pressed={s.tm_reverse} onClick={() => setStep(s.key, { tm_reverse: !s.tm_reverse })} style={{ alignSelf: 'flex-end' }}>Linkslauf</button>
              </div>
            ) : (
              <label className="m-field" style={{ maxWidth: 140 }}>
                <span className="m-group__label">Timer (Min)</span>
                <input className="m-input" inputMode="numeric" value={s.timer_min} onChange={(e) => setStep(s.key, { timer_min: e.target.value })} placeholder="–" />
              </label>
            )}
            {ings.some((i) => i.name.trim()) && (
              <div className="m-field" style={{ gap: 4 }}>
                <span className="m-group__label">Zutaten in diesem Schritt</span>
                <div className="m-chips">
                  {ings.filter((i) => i.name.trim()).map((i) => {
                    const on = s.ingredient_keys.includes(i.key)
                    return (
                      <button key={i.key} type="button" aria-pressed={on} className={'m-chip m-chip--small' + (on ? ' m-chip--on' : '')} onClick={() => setStep(s.key, { ingredient_keys: on ? s.ingredient_keys.filter((x) => x !== i.key) : [...s.ingredient_keys, i.key] })}>{i.name}</button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setSteps((xs) => [...xs, newStep()])}>+ Schritt</button>
      </section>

      <label className="m-field">
        <span className="m-group__label">Notizen</span>
        <AutoArea className="m-input m-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reste, Varianten, was auffällt" />
      </label>

      {err && <p className="hint hint--brown">{err}</p>}
      <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? 'Wird gespeichert …' : 'Speichern'}</button>
      <Link to={back} className="link" style={{ alignSelf: 'center' }}>Abbrechen</Link>
      <div style={{ height: 24 }} />
    </div>
  )
}
