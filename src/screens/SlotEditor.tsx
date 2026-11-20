import { useCallback, useState } from 'react'
import { useCasa } from '../state/HouseholdContext'
import type { Slot } from '../lib/types'
import { PERSON_SLOTS, SLOT_LABEL, TIME_SLOTS, type DayState } from '../lib/week'
import { Chips, Sheet, Toggle } from '../components/ui'
import { shortDate, weekdayLongByIndex, weekdayShort } from '../lib/dates'
import { watchFrom, watchNote } from '../lib/valerie'

interface Draft {
  value: string
  chip: string | null
  at: string
  is_open: boolean
  note: string
  /** passt auf (Zusatz an der Ausnahme fürs Holen) */
  watch: boolean
  /** passt auf bis HH:MM */
  until: string
}


/**
 * Bearbeitet einen oder zwei Slots:
 *  - mit `date`:    Abweichung für genau diesen Tag (week_overrides)
 *  - mit `weekday`: Vorlage der Normalwoche (normal_week)
 */
export function SlotEditor({ slots, date, weekday, state, onClose }: { slots: Slot[]; date?: string; weekday?: number; state: DayState; onClose: () => void }) {
  const { members, people: householdPeople, setOverride, clearOverride, setTemplate } = useCasa()
  const isTemplate = !date
  const close = useCallback(() => onClose(), [onClose])
  const people = [...members.filter((m) => m.role === 'partner').map((m) => m.display_name), ...householdPeople.map((p) => p.name)]

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const out: Record<string, Draft> = {}
    for (const s of slots) {
      const cur = state[s]
      const v = cur?.value ?? ''
      const chip = PERSON_SLOTS.includes(s) && people.includes(v) ? v : null
      const note = isTemplate ? (cur?.note ?? '') : (cur?.overridden ? cur?.note ?? '' : '')
      const w = !isTemplate && s === 'valerie_holen' ? watchFrom(note) : { watch: false, until: null }
      const rest = w.watch ? note.replace(/passt auf(\s+bis\s+\d{1,2}([:.]\d{2})?(\s*uhr)?)?/i, '').replace(/^[\s·,]+|[\s·,]+$/g, '') : note
      out[s] = { value: chip ? '' : v, chip, at: (cur?.at ?? '').slice(0, 5), is_open: cur?.is_open ?? false, note: rest, watch: w.watch, until: w.until ?? '' }
    }
    return out
  })
  const [busy, setBusy] = useState(false)

  const set = (s: Slot, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [s]: { ...d[s], ...patch } }))
  const hasOverride = slots.some((s) => state[s]?.overridden)

  async function save() {
    setBusy(true)
    try {
      for (const s of slots) {
        const d = drafts[s]
        const value = (d.chip ?? d.value).trim() || null
        const at = TIME_SLOTS.includes(s) && d.at ? d.at : null
        if (isTemplate) {
          const wds = weekday === 6 ? [6, 7] : [weekday!]
          for (const wd of wds) await setTemplate({ weekday: wd, slot: s, value: d.is_open ? value : value, at, is_open: d.is_open, note: d.note.trim() || null })
        } else {
          // „passt auf bis 18 Uhr“ steht vorn im Hinweis; die Tageskarte zeigt es und hält die Zeile bis dahin
          const watch = s === 'valerie_holen' && (d.until || d.watch) ? watchNote(d.until || null) : null
          await setOverride({ date: date!, slot: s, value, at, note: [watch, d.note.trim()].filter(Boolean).join(' · ') || null })
        }
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    try {
      for (const s of slots) if (state[s]?.overridden) await clearOverride(date!, s)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={close} title={isTemplate ? 'Normalwoche bearbeiten' : 'Abweichung eintragen'}>
      <div className="between">
        <span className="kicker">{isTemplate ? `Normalwoche · ${weekday === 6 ? 'Wochenende' : weekdayLongByIndex(weekday!)}` : `Abweichung · ${weekdayShort(date!)} ${shortDate(date!)}`}</span>
        <button type="button" className="link" onClick={close}>Schließen</button>
      </div>

      {slots.map((s) => {
        const d = drafts[s]
        const person = PERSON_SLOTS.includes(s)
        return (
          <div className="stack" key={s} style={{ gap: 10 }}>
            <span className="label">{SLOT_LABEL[s]}</span>
            {person && (
              <Chips
                options={people.map((p) => ({ value: p, label: p }))}
                value={d.chip}
                onChange={(p) => set(s, { chip: d.chip === p ? null : p, value: '' })}
              />
            )}
            <input
              className="input-ui"
              type="text"
              value={d.value}
              placeholder={person ? 'oder jemand anderes …' : s === 'anna_arbeit' ? 'z. B. 8 Std. oder frei' : 'Was ist an dem Tag?'}
              onChange={(e) => set(s, { value: e.target.value, chip: null })}
            />
            {TIME_SLOTS.includes(s) && (
              <div className="stack stack--tight">
                <label className="label label--small" htmlFor={`at-${s}`}>Uhrzeit</label>
                <input id={`at-${s}`} className="input-ui" type="time" value={d.at} onChange={(e) => set(s, { at: e.target.value })} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
              </div>
            )}
            {!isTemplate && s === 'valerie_holen' && (
              <div className="stack stack--tight">
                <label className="label label--small" htmlFor="watch-until">Passt auf bis (optional)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input id="watch-until" className="input-ui" type="time" value={d.until} onChange={(e) => set(s, { until: e.target.value, watch: !!e.target.value || d.watch })} style={{ minWidth: 140 }} />
                  {(d.until || d.watch) && <button type="button" className="link" onClick={() => set(s, { until: '', watch: false })}>passt nicht auf</button>}
                </div>
                {d.watch && !d.until && <span className="hint">passt auf (ohne Uhrzeit)</span>}
              </div>
            )}
            {isTemplate && <Toggle on={d.is_open} onChange={(v) => set(s, { is_open: v })} label="Noch offen" hint="Erscheint als offener Punkt in der Woche." />}
            <input className="input-ui" type="text" value={d.note} placeholder={isTemplate ? 'Hinweis (z. B. „wer kocht?")' : 'Hinweis (optional)'} onChange={(e) => set(s, { note: e.target.value })} />
          </div>
        )
      })}

      <button type="button" className="btn" disabled={busy} onClick={save}>
        {isTemplate ? 'Vorlage speichern' : 'Für diesen Tag speichern'}
      </button>
      {!isTemplate && hasOverride && (
        <button type="button" className="link" disabled={busy} onClick={reset}>Abweichung entfernen · zurück zur Normalwoche</button>
      )}
    </Sheet>
  )
}
