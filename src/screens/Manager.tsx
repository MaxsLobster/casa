// Casa-Manager: Chat, der Casa für Max und Anna bedient. Er schlägt Änderungen vor (Vorschau-Karte),
// ausgeführt wird erst nach „Okay“. Danach gibt es „Rückgängig“. Verlauf pro Person im Gerät (letzte 30 Nachrichten).
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCasa } from '../state/HouseholdContext'
import { isDemo, supabase } from '../lib/supabase'

interface Proposal {
  id: string
  tool: string
  input: Record<string, unknown>
  summary: string
  betrifft: string[]
}
interface Msg {
  id: string
  role: 'user' | 'assistant' | 'info'
  text: string
  proposals?: Proposal[]
  /** offen · ausgeführt · abgebrochen */
  state?: 'open' | 'applied' | 'cancelled'
  batch?: string | null
  at: number
}

const CHIPS = ['Ich hab nicht eingekauft', 'Plan uns die Woche', 'Was ist überfällig?', 'Aufräumen']
const UNDO_MS = 30 * 60 * 1000
const key = (id: string) => `casa.manager.${id}`
const uid = () => Math.random().toString(36).slice(2)

function load(id: string): Msg[] {
  try {
    return JSON.parse(localStorage.getItem(key(id)) ?? '[]')
  } catch {
    return []
  }
}
function save(id: string, msgs: Msg[]) {
  try {
    localStorage.setItem(key(id), JSON.stringify(msgs.slice(-30)))
  } catch {
    /* voll oder privat */
  }
}

async function call(body: Record<string, unknown>): Promise<any> {
  if (isDemo || !supabase) throw new Error('Im Demo-Modus gibt es den Manager nicht.')
  const { data, error } = await supabase.functions.invoke('manager', { body })
  if (error) {
    let msg = error.message
    try {
      const j = await (error as { context?: Response }).context?.json()
      if (j?.error) msg = j.error
    } catch {
      /* Text bleibt */
    }
    throw new Error(msg)
  }
  return data
}

export function Manager() {
  const { me, pushNow } = useCasa()
  const [msgs, setMsgs] = useState<Msg[]>(() => (me ? load(me.id) : []))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [kb, setKb] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const location = useLocation()
  const nav = useNavigate()
  // Frage von außen (Hausbuch, Casa aufräumen): einmal schicken, dann aus dem Verlauf der Seite nehmen
  const asked = useRef(false)
  useEffect(() => {
    const ask = (location.state as { ask?: string } | null)?.ask
    if (!ask || asked.current) return
    asked.current = true
    nav(location.pathname, { replace: true, state: null })
    void send(ask)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (me) save(me.id, msgs)
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [msgs, me])

  // iPhone: Tastatur schiebt das Eingabefeld nach oben, statt es zu verdecken
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => {
      vv.removeEventListener('resize', on)
      vv.removeEventListener('scroll', on)
    }
  }, [])

  const update = (id: string, patch: Partial<Msg>) => setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  async function send(raw: string) {
    const t = raw.trim()
    if (!t || busy) return
    setText('')
    // Offene Vorschläge verfallen mit der nächsten Nachricht
    const next: Msg[] = [...msgs.map((m) => (m.state === 'open' ? { ...m, state: 'cancelled' as const } : m)), { id: uid(), role: 'user', text: t, at: Date.now() }]
    setMsgs(next)
    setBusy(true)
    try {
      const history = next.filter((m) => m.role !== 'info').map((m) => ({ role: m.role, text: m.text + (m.proposals?.length ? `\n(Vorschlag: ${m.proposals.map((p) => p.summary).join('; ')} – ${m.state === 'applied' ? 'ausgeführt' : 'nicht ausgeführt'})` : '') }))
      const res = await call({ action: 'chat', messages: history })
      setMsgs((prev) => [...prev, { id: uid(), role: 'assistant', text: res.text ?? '', proposals: res.proposals ?? [], state: res.proposals?.length ? 'open' : undefined, at: Date.now() }])
    } catch (err) {
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: (err as Error).message, at: Date.now() }])
    }
    setBusy(false)
  }

  async function apply(m: Msg) {
    if (!m.proposals?.length || busy) return
    setBusy(true)
    try {
      const res = await call({ action: 'apply', proposals: m.proposals })
      update(m.id, { state: 'applied', batch: res.batch_id })
      const lines = [res.done?.length ? `Erledigt: ${res.done.join(' · ')}` : null, res.failed ? `Nicht geklappt: ${res.failed}` : null].filter(Boolean).join('\n')
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: lines, batch: res.batch_id, at: Date.now() }])
      pushNow()
    } catch (err) {
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: (err as Error).message, at: Date.now() }])
    }
    setBusy(false)
  }

  async function undo(m: Msg) {
    if (!m.batch || busy) return
    setBusy(true)
    try {
      await call({ action: 'undo', batch_id: m.batch })
      update(m.id, { batch: null })
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: 'Zurückgenommen. Alles ist wie vorher.', at: Date.now() }])
    } catch (err) {
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: (err as Error).message, at: Date.now() }])
    }
    setBusy(false)
  }

  const lastBatch = [...msgs].reverse().find((m) => m.role === 'info' && m.batch)?.id

  return (
    <div className="mgr" style={{ paddingBottom: kb }}>
      <header className="mgr__head">
        <Link to="/heute" className="mgr__back">‹ Casa</Link>
        <span className="mgr__title">Casa-Manager</span>
        <button type="button" className="mgr__new" onClick={() => setMsgs([])} disabled={busy || !msgs.length}>Neues Gespräch</button>
      </header>

      <div className="mgr__list">
        {msgs.length === 0 && (
          <div className="mgr__empty">
            <span className="mgr__hello">Was soll ich für euch erledigen?</span>
            <span className="hint">Tippen oder diktieren. Ich schlage vor, ihr sagt Okay.</span>
            <div className="mgr__chips">
              {CHIPS.map((c) => (
                <button key={c} type="button" className="mgr__chip" onClick={() => void send(c)}>{c}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={'mgr__row mgr__row--' + m.role}>
            {m.text && <div className={'mgr__bubble mgr__bubble--' + m.role}>{m.text}</div>}
            {m.proposals && m.proposals.length > 0 && (
              <div className={'mgr__card' + (m.state !== 'open' ? ' mgr__card--done' : '')}>
                <span className="mgr__cardhead">{m.state === 'applied' ? 'Ausgeführt' : m.state === 'cancelled' ? 'Nicht ausgeführt' : 'Ich würde:'}</span>
                <ul className="mgr__items">
                  {m.proposals.map((p) => (
                    <li key={p.id}>
                      {p.summary}
                      {p.betrifft.length > 0 && <span className="mgr__who"> · {p.betrifft.join(' und ')} bekommt eine Mitteilung</span>}
                    </li>
                  ))}
                </ul>
                {m.state === 'open' && (
                  <div className="mgr__actions">
                    <button type="button" className="mgr__ok" disabled={busy} onClick={() => void apply(m)}>Okay</button>
                    <button type="button" className="mgr__ghost" disabled={busy} onClick={() => { update(m.id, { state: 'cancelled' }); setText('Ändere bitte: '); inputRef.current?.focus() }}>Ändern</button>
                    <button type="button" className="mgr__ghost" disabled={busy} onClick={() => update(m.id, { state: 'cancelled' })}>Abbrechen</button>
                  </div>
                )}
              </div>
            )}
            {m.role === 'info' && m.batch && m.id === lastBatch && Date.now() - m.at < UNDO_MS && (
              <button type="button" className="mgr__undo" disabled={busy} onClick={() => void undo(m)}>Rückgängig</button>
            )}
          </div>
        ))}
        {busy && <div className="mgr__row mgr__row--assistant"><div className="mgr__bubble mgr__bubble--assistant mgr__thinking">denkt nach …</div></div>}
        <div ref={endRef} />
      </div>

      <form
        className="mgr__input"
        style={{ bottom: kb }}
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <textarea
          ref={inputRef}
          className="mgr__field"
          rows={1}
          value={text}
          placeholder="Schreib oder diktier …"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(text)
            }
          }}
          aria-label="Nachricht an den Casa-Manager"
        />
        <button type="submit" className="mgr__send" disabled={busy || !text.trim()} aria-label="Senden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  )
}

/** Kleines Sprechblasen-Symbol für die Startseite */
export function ManagerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
      <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
    </svg>
  )
}
