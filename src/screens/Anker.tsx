// Anker-Übersicht: In Bewegung · Ruht · Läuft
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCasa, useNow, useToday } from '../state/HouseholdContext'
import type { Anchor } from '../lib/types'
import { GROUP_TITLE, groupOf, isResting, movedLabel, stepMeta, stepOf, type AnchorGroup } from '../lib/anchors'
import { AnchorIcon, AnchorSheet, PhaseBars } from './AnkerTeile'
import { Chevron, Collapse } from '../components/ui'

const ORDER: AnchorGroup[] = ['bewegung', 'ruht', 'laeuft']

export function Anker() {
  const { anchors, tasks, members, pins, archiveAnchor } = useCasa()
  const today = useToday()
  const now = useNow()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const active = useMemo(() => anchors.filter((a) => !a.archived_at), [anchors])
  const archived = useMemo(() => anchors.filter((a) => a.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')), [anchors])
  const groups = useMemo(() => {
    const g: Record<AnchorGroup, Anchor[]> = { bewegung: [], ruht: [], laeuft: [] }
    for (const a of active) g[groupOf(a, now)].push(a)
    // In Bewegung: zuletzt bewegte zuerst; Ruht: am längsten ruhende zuerst
    g.bewegung.sort((a, b) => b.moved_at.localeCompare(a.moved_at))
    g.laeuft.sort((a, b) => b.moved_at.localeCompare(a.moved_at))
    g.ruht.sort((a, b) => a.moved_at.localeCompare(b.moved_at))
    return g
  }, [active, now])
  const shared = active.filter((a) => a.visibility === 'shared')

  return (
    <div className="page" style={{ gap: 6 }}>
      <header className="between" style={{ alignItems: 'flex-end', marginBottom: 6 }}>
        <div className="stack" style={{ gap: 2 }}>
          <span className="kicker" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Was uns wichtig ist</span>
          <h1 className="h1">Anker</h1>
        </div>
        {shared.length > 0 && (
          <button type="button" className="ank__sunday" onClick={() => nav('/anker/runde')}>Sonntagsrunde</button>
        )}
      </header>

      {active.length === 0 && (
        <p className="hint" style={{ paddingTop: 8 }}>
          Anker sind die Themen, die nie dringend sind und deshalb liegen bleiben. Hier bekommen sie einen nächsten Schritt.
        </p>
      )}

      {ORDER.map((k) =>
        groups[k].length === 0 ? null : (
          <section key={k} className="stack" style={{ gap: 0 }}>
            <div className="ank__group">
              <span className="todo-group__title">{GROUP_TITLE[k]}</span>
              <span className="todo-group__count">{groups[k].length}</span>
            </div>
            {groups[k].map((a) => {
              const step = stepOf(a.id, tasks)
              const rest = k === 'ruht'
              return (
                <button type="button" className="ank__item" key={a.id} onClick={() => nav('/anker/' + a.id)}>
                  <span className="ank__row">
                    <AnchorIcon />
                    <span className="ank__title">{a.title}</span>
                    {a.visibility === 'private' && <span className="ank__pinned">nur ich</span>}
                    {pins.has(a.id) && <span className="ank__pinned">Startseite</span>}
                  </span>
                  <span className="ank__in"><PhaseBars phase={a.phase} /></span>
                  <span className={'ank__in ank__step' + (step ? '' : ' ank__step--none')}>{step ? `→ ${step.title}` : a.ask_next ? 'Und der nächste Schritt?' : 'Nächsten Schritt festlegen'}</span>
                  <span className="ank__in" style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    {step && <span className="ank__small">{stepMeta(step, members, today)}</span>}
                    <span className={'ank__moved' + (rest || isResting(a, now) ? ' ank__moved--rest' : '')}>{movedLabel(a.moved_at, today)}</span>
                  </span>
                </button>
              )
            })}
          </section>
        ),
      )}

      <button type="button" className="link link--hand" style={{ alignSelf: 'flex-start', marginTop: 14, padding: '4px 0' }} onClick={() => setCreating(true)}>
        + Neuer Anker
      </button>

      <div className="spacer" />

      {archived.length > 0 && (
        <div className="stack stack--tight" style={{ alignItems: 'center', paddingTop: 12 }}>
          <button type="button" className="link" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setArchiveOpen((o) => !o)} aria-expanded={archiveOpen}>
            {archiveOpen ? 'Archiv ausblenden' : `Archiv ansehen (${archived.length})`}
            {archiveOpen && <Chevron open />}
          </button>
          <Collapse open={archiveOpen}>
            <div className="stack" style={{ gap: 4, paddingBottom: 8, width: '100%' }}>
              {archived.map((a) => (
                <div className="row" key={a.id}>
                  <span className="row__mark" style={{ color: 'var(--grey-2)' }}>⚓︎</span>
                  <button type="button" className="row__text hand" style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: 'var(--grey)', fontSize: 22, cursor: 'pointer' }} onClick={() => nav('/anker/' + a.id)}>
                    {a.title}
                  </button>
                  <button type="button" className="link" onClick={() => archiveAnchor(a.id, false)}>zurückholen</button>
                </div>
              ))}
            </div>
          </Collapse>
        </div>
      )}

      {creating && <AnchorSheet anchor={null} onClose={() => setCreating(false)} onCreated={(a) => nav('/anker/' + a.id)} />}
    </div>
  )
}
