import { Chips } from '../components/ui'
import type { Repeat } from '../lib/types'

type Key = 'nein' | Repeat

export function RepeatPicker({ value, onChange }: { value: Repeat | null; onChange: (r: Repeat | null) => void }) {
  return (
    <Chips<Key>
      variant="date"
      options={[
        { value: 'nein', label: 'nein' },
        { value: 'weekly', label: 'wöchentlich' },
        { value: 'monthly', label: 'monatlich' },
        { value: 'yearly', label: 'jährlich' },
      ]}
      value={value ?? 'nein'}
      onChange={(k) => onChange(k === 'nein' ? null : k)}
    />
  )
}
