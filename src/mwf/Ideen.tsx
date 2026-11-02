// Ideen-Parkplatz in den MWF-To-Dos: ohne Besitzer, ohne Datum. Später Aufgabe oder Anker daraus machen.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCasa } from '../state/HouseholdContext'
import { areaBase, useArea } from '../state/area'
import type { Idea } from '../lib/types'
import { Chevron, Collapse, HandInput, Sheet } from '../components/ui'
import { AnchorSheet } from '../screens/AnkerTeile'

const KEY = 'casa.ideasOpen'

export function IdeenGruppe() {
  const { ideas, me, members, removeIdea, updateIdea } = useCasa()
  const area = useArea()
  const base = areaBase(area)
  const nav = useNavigate()
  const list = ideas.filter((i) => i.area === area).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== '0'
    } catch {
      return true
    }
  })
  const [editing, setEditing] = useState<Idea | null>(null)
  const [toAnchor, setToAnchor] = useState<Idea | null>(null)
  if (list.length === 0) return null
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? ''

  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? '0' : '1')
      } catch {
        /* egal */
      }
      return !o
    })
  }

  return (
    <section className="stack" style={{ gap: 0 }}>
      <button type="button" className="todo-group__head" onClick={toggle} aria-expanded={open}>
        <span className="todo-group__title">Ideen</span>
        <span className="todo-group__count">{list.length}</span>
        <Chevron open={open} />
      </button>
      <Collapse open={open}>
        <div className="stack" style={{ gap: 0, paddingBottom: 6 }}>
          {list.map((i) => (
            <button type="button" key={i.id} className="mwf__idea" onClick={() => setEditing(i)}>
              <span className="mwf__bulb" aria-hidden>✦</span>
              <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                <span className="task__title" style={{ lineHeight: 1.1, fontSize: 23 }}>{i.text}</span>
                {i.created_by && i.created_by !== me?.id && <span className="heute__sub">von {nameOf(i.created_by)}</span>}
              </span>
            </button>
          ))}
        </div>
      </Collapse>

      {editing && (
        <IdeaSheet
          idea={editing}
          onClose={() => setEditing(null)}
          onSave={async (text) => {
            await updateIdea(editing.id, text)
            setEditing(null)
          }}
          onTask={() => {
            const i = editing
            setEditing(null)
            nav(base + '/neu', { state: { kind: 'aufgabe', title: i.text, idea: i.id } })
          }}
          onAnchor={() => {
            setToAnchor(editing)
            setEditing(null)
          }}
          onRemove={async () => {
            await removeIdea(editing.id)
            setEditing(null)
          }}
        />
      )}
      {toAnchor && (
        <AnchorSheet
          anchor={null}
          initialTitle={toAnchor.text}
          onClose={() => setToAnchor(null)}
          onCreated={async (a) => {
            await removeIdea(toAnchor.id)
            nav(base + '/anker/' + a.id)
          }}
        />
      )}
    </section>
  )
}

function IdeaSheet({ idea, onClose, onSave, onTask, onAnchor, onRemove }: { idea: Idea; onClose: () => void; onSave: (text: string) => void; onTask: () => void; onAnchor: () => void; onRemove: () => void }) {
  const [text, setText] = useState(idea.text)
  const [confirm, setConfirm] = useState(false)
  const changed = text.trim() !== idea.text && text.trim().length > 0
  return (
    <Sheet onClose={onClose} title="Idee">
      <div className="between">
        <span className="kicker">Idee</span>
        <button type="button" className="link" onClick={onClose}>Schließen</button>
      </div>
      <HandInput value={text} onChange={setText} placeholder="Was ist die Idee?" />
      {changed && <button type="button" className="btn" onClick={() => onSave(text.trim())}>Speichern</button>}
      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Weiter damit</span>
        <div className="chips">
          <button type="button" className="chip" onClick={onTask}>Zur Aufgabe machen</button>
          <button type="button" className="chip" onClick={onAnchor}>⚓︎ Zum Anker machen</button>
        </div>
        <span className="hint">Die Idee verschwindet dann aus dem Parkplatz.</span>
      </div>
      {!confirm ? (
        <button type="button" className="link" onClick={() => setConfirm(true)}>Idee entfernen</button>
      ) : (
        <div className="between">
          <span className="hint">Wirklich entfernen?</span>
          <button type="button" className="link" style={{ color: 'var(--brown)' }} onClick={onRemove}>Ja</button>
          <button type="button" className="link" onClick={() => setConfirm(false)}>Nein</button>
        </div>
      )}
    </Sheet>
  )
}
