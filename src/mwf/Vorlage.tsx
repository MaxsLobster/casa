// Checklisten-Vorlage der Runde: Titel, wer, Abschnitt, Fälligkeit, laufend, Reihenfolge
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCasa } from '../state/HouseholdContext'
import type { TemplateRow, TemplateSection } from '../lib/types'
import { SECTIONS, sectionLabel } from '../lib/mwf'
import { Chips, HandInput, Sheet, Toggle } from '../components/ui'

const ORDER: Record<TemplateSection, number> = { start: 0, until: 1, before: 2, eve: 3, fair: 4 }

export function Vorlage() {
  const { template, members, updateTemplateRow } = useCasa()
  const rows = useMemo(
    () => template.filter((r) => r.area === 'mwf').sort((a, b) => ORDER[a.section] - ORDER[b.section] || (a.section === 'before' ? (b.days_before ?? 0) - (a.days_before ?? 0) : 0) || a.sort - b.sort),
    [template],
  )
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [creating, setCreating] = useState(false)
  const nameOf = (id: string | null) => (id ? (members.find((m) => m.id === id)?.display_name ?? '') : 'beide')

  async function move(r: TemplateRow, dir: -1 | 1) {
    const same = rows.filter((x) => x.section === r.section && x.days_before === r.days_before)
    const i = same.findIndex((x) => x.id === r.id)
    const other = same[i + dir]
    if (!other) return
    await updateTemplateRow(r.id, { sort: other.sort })
    await updateTemplateRow(other.id, { sort: r.sort })
  }

  let lastKey = ''
  return (
    <div className="page" style={{ gap: 6 }}>
      <Link to="/mwf/checkliste" className="ank__back">‹ Checkliste</Link>
      <header className="stack" style={{ gap: 2, marginBottom: 6 }}>
        <span className="kicker" style={{ fontSize: 11 }}>Jede Runde gleich</span>
        <h1 className="h1">Vorlage</h1>
      </header>
      <p className="hint" style={{ fontSize: 13 }}>Neue Punkte kommen auch in die laufende Runde. Geänderte gelten ab der nächsten.</p>

      {rows.map((r) => {
        const key = r.section === 'before' ? `before:${r.days_before ?? 0}` : r.section
        const head = key !== lastKey
        lastKey = key
        return (
          <div key={r.id}>
            {head && (
              <div className="ank__group" style={{ marginTop: 14 }}>
                <span className="todo-group__title">{sectionLabel(r.section, r.days_before)}</span>
              </div>
            )}
            <div className="mwf__trow">
              <button type="button" className="task__body" onClick={() => setEditing(r)}>
                <span className="task__title" style={{ fontSize: 22, lineHeight: 1.1 }}>{r.title}</span>
                <span className="heute__sub">
                  {nameOf(r.owner_member_id)}
                  {' · '}
                  {r.is_running ? 'laufend' : r.days_before == null ? 'Freitag der Startwoche' : r.days_before === 0 ? 'am Messetag' : r.days_before === 1 ? 'Tag davor' : `${r.days_before} Tage vorher`}
                </span>
              </button>
              <span className="mwf__order">
                <button type="button" className="mwf__orderbtn" aria-label="nach oben" onClick={() => move(r, -1)}>▲</button>
                <button type="button" className="mwf__orderbtn" aria-label="nach unten" onClick={() => move(r, 1)}>▼</button>
              </span>
            </div>
          </div>
        )
      })}

      <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', marginTop: 14, padding: '4px 0' }} onClick={() => setCreating(true)}>
        + Punkt
      </button>
      <div className="spacer" />

      {(editing || creating) && <RowSheet row={editing} onClose={() => { setEditing(null); setCreating(false) }} />}
    </div>
  )
}

function RowSheet({ row, onClose }: { row: TemplateRow | null; onClose: () => void }) {
  const { members, addTemplateRow, updateTemplateRow, removeTemplateRow } = useCasa()
  const partners = members.filter((m) => m.role === 'partner')
  const [title, setTitle] = useState(row?.title ?? '')
  const [who, setWho] = useState<string>(row?.owner_member_id ?? 'beide')
  const [section, setSection] = useState<TemplateSection>(row?.section ?? 'before')
  const [friday, setFriday] = useState(row ? row.days_before == null : false)
  const [days, setDays] = useState<string>(row?.days_before != null ? String(row.days_before) : '7')
  const [running, setRunning] = useState(row?.is_running ?? false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const fixedDays = section === 'eve' ? 1 : section === 'fair' ? 0 : null
  const needsDays = fixedDays == null && !(section === 'start' && friday) && !running
  const daysNum = Number(days)
  const ready = title.trim().length > 0 && (!needsDays || (Number.isInteger(daysNum) && daysNum >= 0))

  function pickSection(s: TemplateSection) {
    setSection(s)
    if (s === 'start') setFriday(true)
    if (s !== 'start') setFriday(false)
    if (s !== 'until') setRunning(false)
  }

  async function save() {
    if (!ready) return
    setBusy(true)
    try {
      const days_before = running ? 0 : fixedDays != null ? fixedDays : section === 'start' && friday ? null : daysNum
      const input = { title: title.trim(), owner_member_id: who === 'beide' ? null : who, section, days_before, is_running: running }
      if (row) await updateTemplateRow(row.id, input)
      else await addTemplateRow(input)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} title={row ? 'Punkt bearbeiten' : 'Neuer Punkt'}>
      <div className="between">
        <span className="kicker">{row ? 'Punkt bearbeiten' : 'Neuer Punkt'}</span>
        <button type="button" className="link" onClick={onClose}>Schließen</button>
      </div>
      <HandInput value={title} onChange={setTitle} placeholder="Was ist zu tun?" autoFocus={!row} />
      <div className="stack">
        <span className="label">Wer?</span>
        <Chips options={[...partners.map((m) => ({ value: m.id, label: m.display_name })), { value: 'beide', label: 'Beide' }]} value={who} onChange={setWho} />
      </div>
      <div className="stack">
        <span className="label">Abschnitt</span>
        <Chips variant="date" options={SECTIONS.map((s) => ({ value: s.value, label: s.label }))} value={section} onChange={pickSection} />
      </div>
      {section === 'until' && (
        <Toggle on={running} onChange={setRunning} label="Laufend" hint="Kein Abhaken, gestrichelter Kreis, endet am Messetag." />
      )}
      {section === 'start' && !running && (
        <div className="stack">
          <span className="label">Fällig</span>
          <Chips variant="date" options={[{ value: 'fr', label: 'Freitag der Startwoche' }, { value: 'days', label: 'Tage vor der Messe' }]} value={friday ? 'fr' : 'days'} onChange={(v) => setFriday(v === 'fr')} />
        </div>
      )}
      {needsDays && (
        <div className="stack stack--tight">
          <label className="label label--small" htmlFor="tpl-days">Tage vor der Messe</label>
          <input id="tpl-days" className="input-ui" type="number" min={0} max={120} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} style={{ alignSelf: 'flex-start', minWidth: 120 }} />
        </div>
      )}
      {fixedDays != null && <span className="hint">{section === 'eve' ? 'Fällig am Tag vor der Messe.' : 'Fällig am Messetag.'}</span>}
      <button type="button" className="btn" disabled={!ready || busy} onClick={save}>{ready ? (row ? 'Speichern' : 'Anlegen') : 'Titel fehlt noch'}</button>
      {row && (!confirm ? (
        <button type="button" className="link" onClick={() => setConfirm(true)}>Punkt entfernen</button>
      ) : (
        <div className="between">
          <span className="hint">Wirklich? Bestehende Rundenpunkte bleiben.</span>
          <button type="button" className="link" style={{ color: 'var(--brown)' }} onClick={async () => { await removeTemplateRow(row.id); onClose() }}>Ja</button>
          <button type="button" className="link" onClick={() => setConfirm(false)}>Nein</button>
        </div>
      ))}
    </Sheet>
  )
}
