// Zurufe: Inbox (gelesen · → Aufgabe · antworten), darunter Gesendet und Archiv (zugeklappt)
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCasa, useNow } from '../state/HouseholdContext'
import type { Shout } from '../lib/types'
import { agoLabel } from '../lib/mwf'
import { Chevron, Collapse, HandInput, Sheet } from '../components/ui'

export const SHOUT_HINT = 'Bitte keine Telefonnummern oder E-Mail-Adressen.'
const MAX_OLD = 30

export function Zurufe() {
  const { me, members, shouts, readShout, addShout } = useCasa()
  const now = useNow()
  const nav = useNavigate()
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? ''
  const byId = useMemo(() => new Map(shouts.map((s) => [s.id, s])), [shouts])
  const newest = (a: Shout, b: Shout) => b.created_at.localeCompare(a.created_at)

  const inbox = useMemo(() => shouts.filter((s) => s.to_member_id === me?.id && !s.archived_at).sort(newest), [shouts, me?.id])
  const sent = useMemo(() => shouts.filter((s) => s.from_member_id === me?.id).sort(newest).slice(0, MAX_OLD), [shouts, me?.id])
  const archive = useMemo(() => shouts.filter((s) => s.to_member_id === me?.id && !!s.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')).slice(0, MAX_OLD), [shouts, me?.id])

  const [sentOpen, setSentOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<Shout | null>(null)

  // Bezug: „↩ auf „…""
  const refText = (s: Shout) => {
    const o = s.reply_to ? byId.get(s.reply_to) : null
    if (!o) return null
    return o.text.length > 48 ? o.text.slice(0, 46).trimEnd() + ' …' : o.text
  }

  function toTask(s: Shout) {
    nav('/mwf/neu', { state: { kind: 'aufgabe', title: s.text, who: me?.id, shout: s.id } })
  }

  return (
    <div className="page" style={{ gap: 6 }}>
      <Link to="/mwf/hub" className="ank__back">‹ Hub</Link>
      <header className="stack" style={{ gap: 2, marginBottom: 6 }}>
        <span className="kicker" style={{ fontSize: 11 }}>Kurz zugerufen</span>
        <h1 className="h1">Zurufe</h1>
      </header>

      {inbox.length === 0 && <p className="hint" style={{ paddingTop: 4 }}>Nichts Neues. Schön.</p>}
      {inbox.map((s) => {
        const ref = refText(s)
        return (
          <div className="mwf__shout mwf__shout--inbox" key={s.id}>
            {!s.read_at && <span className="mwf__dot" aria-label="ungelesen" />}
            <span className="stack" style={{ gap: 3, minWidth: 0, flex: 1 }}>
              {ref && <span className="hint" style={{ fontSize: 12 }}>↩ auf „{ref}“</span>}
              <span className="mwf__shout-text">{s.text}</span>
              <span className="heute__sub">von {nameOf(s.from_member_id)} · {agoLabel(s.created_at, now)}</span>
              <span className="mwf__shout-actions">
                <button type="button" className="mwf__act" onClick={() => readShout(s.id)}>gelesen</button>
                <button type="button" className="mwf__act" onClick={() => toTask(s)}>→ Aufgabe</button>
                <button type="button" className="mwf__act" onClick={() => setReplyTo(s)}>antworten</button>
              </span>
            </span>
          </div>
        )
      })}

      {sent.length > 0 && (
        <section className="stack" style={{ gap: 0, marginTop: 18 }}>
          <button type="button" className="todo-group__head" onClick={() => setSentOpen((o) => !o)} aria-expanded={sentOpen}>
            <span className="todo-group__title">Gesendet</span>
            <span className="todo-group__count">{sent.length}</span>
            <Chevron open={sentOpen} />
          </button>
          <Collapse open={sentOpen}>
            <div className="stack" style={{ gap: 0, paddingBottom: 6 }}>
              {sent.map((s) => (
                <div className="mwf__shout mwf__shout--old" key={s.id}>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="mwf__shout-text mwf__shout-text--old">{s.text}</span>
                    <span className="heute__sub">
                      an {nameOf(s.to_member_id)} · {agoLabel(s.created_at, now)}
                      {s.read_at ? <span style={{ color: 'var(--green)' }}> · ✓ gelesen</span> : ' · noch nicht gelesen'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Collapse>
        </section>
      )}

      {archive.length > 0 && (
        <section className="stack" style={{ gap: 0 }}>
          <button type="button" className="todo-group__head" onClick={() => setArchiveOpen((o) => !o)} aria-expanded={archiveOpen}>
            <span className="todo-group__title">Archiv</span>
            <span className="todo-group__count">{archive.length}</span>
            <Chevron open={archiveOpen} />
          </button>
          <Collapse open={archiveOpen}>
            <div className="stack" style={{ gap: 0, paddingBottom: 6 }}>
              {archive.map((s) => (
                <div className="mwf__shout mwf__shout--old" key={s.id}>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="mwf__shout-text mwf__shout-text--old">{s.text}</span>
                    <span className="heute__sub">von {nameOf(s.from_member_id)} · {agoLabel(s.created_at, now)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Collapse>
        </section>
      )}

      <div className="spacer" />

      {replyTo && (
        <ReplySheet
          original={replyTo}
          toName={nameOf(replyTo.from_member_id)}
          onClose={() => setReplyTo(null)}
          onSend={async (text) => {
            await addShout(replyTo.from_member_id, text, replyTo.id)
            await readShout(replyTo.id)
            setReplyTo(null)
          }}
        />
      )}
    </div>
  )
}

function ReplySheet({ original, toName, onClose, onSend }: { original: Shout; toName: string; onClose: () => void; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = text.trim().length > 0
  async function send() {
    if (!ready) return
    setBusy(true)
    try {
      await onSend(text.trim())
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={onClose} title={`Antwort an ${toName}`}>
      <div className="between">
        <span className="kicker">Antwort an {toName}</span>
        <button type="button" className="link" onClick={onClose}>Schließen</button>
      </div>
      <span className="hint" style={{ fontSize: 12 }}>↩ auf „{original.text.length > 80 ? original.text.slice(0, 78).trimEnd() + ' …' : original.text}“</span>
      <HandInput value={text} onChange={setText} placeholder="Kurz zurück …" autoFocus />
      <span className="hint">{SHOUT_HINT}</span>
      <button type="button" className="btn" disabled={!ready || busy} onClick={send}>{busy ? 'Einen Moment …' : 'Senden'}</button>
    </Sheet>
  )
}
