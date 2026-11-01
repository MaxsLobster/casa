// Offene Slots eines Tages übernehmen (Woche und Heute): Ich / Anna / Oma … bzw. Familientag festlegen, Übergabe bei „Valerie ist weg"
import { useCallback, useState } from 'react'
import { useCasa } from '../state/HouseholdContext'
import { addDays, shortDate, weekday, weekdayLongByIndex, type ISODate } from '../lib/dates'
import type { DayState } from '../lib/week'
import { handoverOpen, type DayEffects } from '../lib/effects'
import type { Slot } from '../lib/types'
import { Chips, Sheet } from '../components/ui'

/** Offene Slots eines Tages übernehmen: Ich / Anna / Oma … bzw. Familientag festlegen, Übergabe bei „Valerie ist weg" */
export function Takeover({ date, state, fx, onClose }: { date: ISODate; state: DayState; fx: DayEffects; onClose: () => void }) {
  const { me, members, people, setOverride, updateEvent } = useCasa()
  const close = useCallback(() => onClose(), [onClose])
  const partners = members.filter((m) => m.role === 'partner')
  const open: Slot[] = (['valerie_bringen', 'valerie_holen', 'valerie_tag', 'abend_essen', 'abend_bett'] as Slot[]).filter((s) => state[s]?.is_open)
  const weekendOpen = !!state.wochenende?.is_open
  const ho = handoverOpen(fx)
  const [choice, setChoice] = useState<Record<string, string | null>>({})
  const [times, setTimes] = useState<Record<string, string>>({})
  const [familientag, setFamilientag] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const label: Record<string, string> = {
    valerie_bringen: 'Wer bringt Valerie?',
    valerie_holen: 'Wer holt Valerie?',
    valerie_tag: 'Valerie tagsüber · wer?',
    abend_essen: 'Wer kocht?',
    abend_bett: 'Wer bringt ins Bett?',
    dropoff: 'Wer bringt sie hin?',
    pickup: 'Wer holt sie ab?',
  }
  const withTime = ['valerie_bringen', 'valerie_holen', 'dropoff', 'pickup']
  const base = [...partners.map((m) => ({ value: m.display_name, label: m.id === me?.id ? 'Ich' : m.display_name }))]
  const options = (key: string) => [...base, ...(key === 'valerie_tag' ? [{ value: 'beide', label: 'Beide' }] : []), ...people.map((p) => ({ value: p.name, label: p.name }))]
  const wd = weekday(date)
  const sat = wd === 6 ? date : wd === 7 ? addDays(date, -1) : date
  const sun = addDays(sat, 1)
  const handover = [...(ho.dropoff ? ['dropoff'] : []), ...(ho.pickup ? ['pickup'] : [])]

  async function save() {
    setBusy(true)
    try {
      for (const s of open) if (choice[s]) await setOverride({ date, slot: s, value: choice[s]!, at: withTime.includes(s) ? times[s] || null : null })
      if (fx.valerieWeg) {
        const patch: Record<string, string | null> = {}
        if (ho.dropoff && choice.dropoff) {
          patch.dropoff_by = choice.dropoff
          patch.dropoff_at = times.dropoff || null
        }
        if (ho.pickup && choice.pickup) {
          patch.pickup_by = choice.pickup
          patch.pickup_at = times.pickup || null
        }
        if (Object.keys(patch).length) await updateEvent(fx.valerieWeg.base_id, patch)
      }
      if (weekendOpen && familientag) {
        await setOverride({ date: familientag === 'sa' ? sat : sun, slot: 'wochenende', value: 'Familientag' })
        await setOverride({ date: familientag === 'sa' ? sun : sat, slot: 'wochenende', value: 'Geteilte Betreuung' })
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }
  const ready = open.some((s) => choice[s]) || handover.some((k) => choice[k]) || (weekendOpen && familientag)

  const block = (key: string) => (
    <div className="stack" key={key}>
      <span className="label">{label[key]}</span>
      <Chips options={options(key)} value={choice[key] ?? null} onChange={(v) => setChoice((c) => ({ ...c, [key]: v }))} />
      {withTime.includes(key) && (
        <div className="stack stack--tight">
          <label className="label label--small" htmlFor={`to-${key}`}>Wann? (optional)</label>
          <input id={`to-${key}`} className="input-ui" type="time" value={times[key] ?? ''} onChange={(e) => setTimes((t) => ({ ...t, [key]: e.target.value }))} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
        </div>
      )}
    </div>
  )

  return (
    <Sheet onClose={close} title="Übernehmen">
      <div className="between">
        <span className="kicker">{weekdayLongByIndex(wd)}, {shortDate(date)}</span>
        <button type="button" className="link" onClick={close}>Schließen</button>
      </div>
      {handover.map(block)}
      {open.map(block)}
      {weekendOpen && (
        <div className="stack">
          <span className="label">Welcher Tag ist Familientag?</span>
          <Chips options={[{ value: 'sa', label: 'Samstag' }, { value: 'so', label: 'Sonntag' }]} value={familientag} onChange={setFamilientag} variant="date" />
          <span className="hint">Der andere Tag wird „geteilte Betreuung“.</span>
        </div>
      )}
      <button type="button" className="btn" disabled={!ready || busy} onClick={save}>Übernehmen</button>
    </Sheet>
  )
}
