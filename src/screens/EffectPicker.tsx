// „Was bedeutet das?" – Auswahl der Wirkung eines Ereignisses, plus Übergabe-Felder bei „Valerie ist weg"
import { Chips } from '../components/ui'
import type { Event, EventEffect, Member, Person } from '../lib/types'

/** Auswahlwert: 'termin' | 'valerie_weg' | 'kita_zu' | 'weg:<member id>' */
export type EffectChoice = string

export function effectChoice(e: Pick<Event, 'effect' | 'member_id'>): EffectChoice {
  if (e.effect === 'eltern_weg' && e.member_id) return 'weg:' + e.member_id
  return e.effect ?? 'termin'
}

export function parseEffect(c: EffectChoice): { effect: EventEffect; member_id: string | null } {
  if (c.startsWith('weg:')) return { effect: 'eltern_weg', member_id: c.slice(4) }
  if (c === 'valerie_weg' || c === 'kita_zu') return { effect: c, member_id: null }
  return { effect: 'termin', member_id: null }
}

export function EffectChips({ value, onChange, partners }: { value: EffectChoice; onChange: (v: EffectChoice) => void; partners: Member[] }) {
  const options = [
    { value: 'termin', label: 'Nur Termin' },
    { value: 'valerie_weg', label: 'Valerie ist weg' },
    { value: 'kita_zu', label: 'Kita zu' },
    ...partners.map((m) => ({ value: 'weg:' + m.id, label: `${m.display_name} ist weg` })),
  ]
  return (
    <div className="stack">
      <span className="label">Was bedeutet das?</span>
      <Chips options={options} value={value} onChange={onChange} />
      {value === 'valerie_weg' && <span className="hint">Bringen, Holen und Bettgehen entfallen an diesen Tagen. Valerie geht nicht in die Kita.</span>}
      {value === 'kita_zu' && <span className="hint">Bringen und Holen entfallen. Pro Tag fragt die Woche, wer Valerie tagsüber hat.</span>}
      {value.startsWith('weg:') && <span className="hint">Alles, was an diesen Tagen bei der Person liegt, wird offen. Der andere bekommt eine Mitteilung.</span>}
    </div>
  )
}

export interface Handover {
  dropoff_by: string | null
  dropoff_at: string
  pickup_by: string | null
  pickup_at: string
}

export const EMPTY_HANDOVER: Handover = { dropoff_by: null, dropoff_at: '', pickup_by: null, pickup_at: '' }

export function HandoverFields({ value, onChange, me, members, people }: { value: Handover; onChange: (v: Handover) => void; me: Member | null; members: Member[]; people: Person[] }) {
  const options = [
    ...members.filter((m) => m.role === 'partner').map((m) => ({ value: m.display_name, label: m.id === me?.id ? 'Ich' : m.display_name })),
    ...people.map((p) => ({ value: p.name, label: p.name })),
  ]
  const toggle = (key: 'dropoff_by' | 'pickup_by', v: string) => onChange({ ...value, [key]: value[key] === v ? null : v })
  return (
    <>
      <div className="stack">
        <span className="label">Wer bringt sie hin? (optional)</span>
        <Chips options={options} value={value.dropoff_by} onChange={(v) => toggle('dropoff_by', v)} />
        <input className="input-ui" type="time" aria-label="Wann hinbringen?" value={value.dropoff_at} onChange={(e) => onChange({ ...value, dropoff_at: e.target.value })} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
      </div>
      <div className="stack">
        <span className="label">Wer holt sie ab? (optional)</span>
        <Chips options={options} value={value.pickup_by} onChange={(v) => toggle('pickup_by', v)} />
        <input className="input-ui" type="time" aria-label="Wann abholen?" value={value.pickup_at} onChange={(e) => onChange({ ...value, pickup_at: e.target.value })} style={{ alignSelf: 'flex-start', minWidth: 140 }} />
      </div>
      <span className="hint">Ohne Angabe bleibt in der Woche ein offener Chip zum Übernehmen. Gold endet am letzten Tag zur Abholzeit.</span>
    </>
  )
}
