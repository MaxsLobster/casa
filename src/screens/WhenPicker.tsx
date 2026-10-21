import { useState } from 'react'
import { Chips } from '../components/ui'
import { addDays, nextWeekdayOnOrAfter, shortDate, startOfWeek, weekdayShort } from '../lib/dates'

type Key = 'heute' | 'morgen' | 'freitag' | 'naechste' | 'sa' | 'so' | 'datum'

/**
 * „Wann?"-Chips: Heute · Morgen · Freitag · Nächste Woche · Datum …
 * Für Termine: Heute · Morgen · Sa · So · Datum …
 */
export function WhenPicker({ kind, value, onChange, today }: { kind: 'aufgabe' | 'termin'; value: string | null; onChange: (d: string | null) => void; today: string }) {
  const morgen = addDays(today, 1)
  const freitag = nextWeekdayOnOrAfter(5, today) === today ? addDays(today, 7) : nextWeekdayOnOrAfter(5, today)
  const naechste = addDays(startOfWeek(today), 7)
  const sa = nextWeekdayOnOrAfter(6, today)
  const so = nextWeekdayOnOrAfter(7, today)

  const presets: { key: Key; label: string; date: string }[] =
    kind === 'termin'
      ? [
          { key: 'heute', label: 'Heute', date: today },
          { key: 'morgen', label: 'Morgen', date: morgen },
          { key: 'sa', label: 'Sa', date: sa },
          { key: 'so', label: 'So', date: so },
        ]
      : [
          { key: 'heute', label: 'Heute', date: today },
          { key: 'morgen', label: 'Morgen', date: morgen },
          { key: 'freitag', label: 'Freitag', date: freitag },
          { key: 'naechste', label: 'Nächste Woche', date: naechste },
        ]

  const matched = value ? presets.find((p) => p.date === value)?.key ?? null : null
  const [custom, setCustom] = useState<boolean>(!!value && !matched)
  const selected: Key | null = custom ? 'datum' : matched

  const customLabel = custom && value ? `${weekdayShort(value)} ${shortDate(value)}` : 'Datum …'

  return (
    <div className="stack">
      <Chips
        variant="date"
        options={[...presets.map((p) => ({ value: p.key, label: p.label })), { value: 'datum' as Key, label: customLabel }]}
        value={selected}
        onChange={(k) => {
          if (k === 'datum') {
            setCustom(true)
            if (!value) onChange(null)
          } else {
            setCustom(false)
            onChange(presets.find((p) => p.key === k)!.date)
          }
        }}
      />
      {custom && (
        <input
          className="input-ui"
          type="date"
          value={value ?? ''}
          min={addDays(today, -365)}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ alignSelf: 'flex-start', minWidth: 180 }}
        />
      )}
    </div>
  )
}
