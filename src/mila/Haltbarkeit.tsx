// Mila · Haltbarkeit (geschätzt): Stichwort → Tage ab Einkauf. Max kann die Werte ändern.
import { useState } from 'react'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import type { MilaShelfRule } from '../lib/types'

const ORDER = { kurz: 0, mittel: 1, lang: 2, vorrat: 3 }

export function Haltbarkeit() {
  const { wahl } = useMila()
  const [neu, setNeu] = useState('')
  const [tage, setTage] = useState('3')
  const rules = [...wahl.rules].sort((a, b) => (a.tage ?? 99) - (b.tage ?? 99) || ORDER[a.gruppe] - ORDER[b.gruppe] || a.stichwort.localeCompare(b.stichwort, 'de'))
  return (
    <MilaPage>
      <header className="stack stack--tight">
        <span className="m-title">Haltbarkeit</span>
        <span className="m-hint">geschätzt · Tage ab dem Einkauf. Passt ein Stichwort im Namen einer Zutat, gilt der kürzeste Wert. Ohne Treffer: Obst & Gemüse 5, Kühlregal 7, Fleisch & Fisch 2, Vorrat unbegrenzt.</span>
      </header>
      <div className="mk__list">
        {rules.map((r) => (
          <Row key={r.id} rule={r} />
        ))}
      </div>
      <div className="mh__ruleadd">
        <input className="m-input" placeholder="Stichwort, z. B. lauch" value={neu} onChange={(e) => setNeu(e.target.value)} aria-label="Neues Stichwort" />
        <input className="m-input mh__days" inputMode="numeric" value={tage} onChange={(e) => setTage(e.target.value.replace(/\D/g, ''))} aria-label="Tage" />
        <button type="button" className="mh__take" disabled={!neu.trim()} onClick={() => { void wahl.saveRule({ stichwort: neu, tage: tage === '' ? null : Number(tage) }); setNeu('') }}>dazu</button>
      </div>
    </MilaPage>
  )
}

function Row({ rule }: { rule: MilaShelfRule }) {
  const { wahl } = useMila()
  const set = (t: number | null) => void wahl.saveRule({ id: rule.id, stichwort: rule.stichwort, tage: t })
  return (
    <div className="mh__fridge">
      <span className="mh__fname">{rule.stichwort}</span>
      <button type="button" className="mw__round mw__round--s" aria-label={`${rule.stichwort}: einen Tag weniger`} onClick={() => set(Math.max(0, (rule.tage ?? 1) - 1))}>−</button>
      <span className="mh__daysval">{rule.tage === null ? '∞' : `${rule.tage} ${rule.tage === 1 ? 'Tag' : 'Tage'}`}</span>
      <button type="button" className="mw__round mw__round--s" aria-label={`${rule.stichwort}: einen Tag mehr`} onClick={() => set(Math.min(60, (rule.tage ?? 0) + 1))}>+</button>
      <button type="button" className="m-meal__x" aria-label={`${rule.stichwort} löschen`} onClick={() => void wahl.removeRule(rule.id)}>×</button>
    </div>
  )
}
