// Casa-Manager als Blatt von unten über der aktuellen Seite. Er schlägt Änderungen vor (Vorschau-Karte),
// ausgeführt wird erst nach „Okay“, danach gibt es „Rückgängig“. Verlauf pro Person im Gerät (letzte 30 Nachrichten).
// Pille: Antippen öffnet das Blatt, Gedrückthalten = sprechen. Kamera-Symbol: Foto für diese eine Anfrage.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { useCasa } from '../state/HouseholdContext'
import { isDemo, supabase } from '../lib/supabase'
import { BubbleIcon } from '../components/Nav'
import { listen, managerBus, speechState, type Listening } from './managerBus'

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
  /** Nutzer-Nachricht hatte ein Foto (das Foto selbst wird nicht gespeichert) */
  photo?: boolean
  proposals?: Proposal[]
  /** offen · ausgeführt · abgebrochen */
  state?: 'open' | 'applied' | 'cancelled'
  batch?: string | null
  at: number
}
interface Photo {
  data: string
  media_type: 'image/jpeg'
  url: string
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

/** Foto im Gerät auf höchstens 1600 px verkleinern (JPEG) */
async function shrink(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Das Foto ließ sich nicht öffnen.'))
      i.src = url
    })
    const f = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * f)
    c.height = Math.round(img.naturalHeight * f)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const dataUrl = c.toDataURL('image/jpeg', 0.82)
    return { data: dataUrl.split(',')[1], media_type: 'image/jpeg', url: dataUrl }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------------------------------------------------------------------------
// Blatt
// ---------------------------------------------------------------------------
export function ManagerSheet() {
  const { me, pushNow } = useCasa()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>(() => (me ? load(me.id) : []))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [vv, setVv] = useState({ kb: 0, h: window.innerHeight })
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sendRef = useRef<(t: string) => void>(() => undefined)

  useEffect(() => {
    if (me) save(me.id, msgs)
    if (open) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [msgs, me, open])

  // Kanal: andere Stellen öffnen das Blatt (mit Frage) oder wollen direkt die Tastatur
  useEffect(
    () =>
      managerBus.register({
        open: (ask) => {
          setOpen(true)
          if (ask) window.setTimeout(() => sendRef.current(ask), 0)
        },
        openAndFocus: (h) => {
          // synchron rendern und fokussieren: iOS öffnet die Tastatur nur in derselben Geste
          flushSync(() => {
            setOpen(true)
            setHint(h ?? null)
          })
          inputRef.current?.focus()
        },
      }),
    [],
  )

  // iPhone: Tastatur schiebt das Blatt nach oben, statt es zu verdecken
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const on = () => setVv({ kb: Math.max(0, window.innerHeight - v.height - v.offsetTop), h: v.height })
    v.addEventListener('resize', on)
    v.addEventListener('scroll', on)
    return () => {
      v.removeEventListener('resize', on)
      v.removeEventListener('scroll', on)
    }
  }, [])

  // Blatt offen: Seite dahinter nicht scrollen, Escape schließt
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const update = (id: string, patch: Partial<Msg>) => setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  async function send(raw: string) {
    const t = raw.trim() || (photo ? 'Was steht auf dem Foto? Mach mir einen Vorschlag.' : '')
    if (!t || busy) return
    const img = photo
    setText('')
    setPhoto(null)
    setHint(null)
    // Offene Vorschläge verfallen mit der nächsten Nachricht
    const last: Msg = { id: uid(), role: 'user', text: t, photo: !!img, at: Date.now() }
    const next: Msg[] = [...msgs.map((m) => (m.state === 'open' ? { ...m, state: 'cancelled' as const } : m)), last]
    setMsgs(next)
    setBusy(true)
    try {
      const history = next
        .filter((m) => m.role !== 'info')
        .map((m) => ({ role: m.role, text: (m.photo && m !== last ? '[Foto geschickt] ' : '') + m.text + (m.proposals?.length ? `\n(Vorschlag: ${m.proposals.map((p) => p.summary).join('; ')} – ${m.state === 'applied' ? 'ausgeführt' : 'nicht ausgeführt'})` : '') }))
      const res = await call({ action: 'chat', messages: history, ...(img ? { image: { media_type: img.media_type, data: img.data } } : {}) })
      setMsgs((prev) => [...prev, { id: uid(), role: 'assistant', text: res.text ?? '', proposals: res.proposals ?? [], state: res.proposals?.length ? 'open' : undefined, at: Date.now() }])
    } catch (err) {
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: (err as Error).message, at: Date.now() }])
    }
    setBusy(false)
  }
  sendRef.current = (t) => void send(t)

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

  async function pick(f: File | undefined) {
    if (!f) return
    try {
      setPhoto(await shrink(f))
    } catch (err) {
      setMsgs((prev) => [...prev, { id: uid(), role: 'info', text: (err as Error).message, at: Date.now() }])
    }
  }

  const lastBatch = [...msgs].reverse().find((m) => m.role === 'info' && m.batch)?.id
  if (!open) return null
  const maxH = Math.min(vv.h - 24, window.innerHeight * 0.9)

  return (
    <div className="mgs-backdrop" onClick={() => setOpen(false)}>
      <section className="mgr-sheet" role="dialog" aria-modal="true" aria-label="Casa-Manager" style={{ bottom: vv.kb, height: maxH }} onClick={(e) => e.stopPropagation()}>
        <span className="mgs__grip" aria-hidden />
        <header className="mgs__head">
          <span className="mgs__icon" aria-hidden><BubbleIcon /></span>
          <span className="mgs__titles">
            <span className="mgs__title">Casa-Manager</span>
            <span className="mgs__sub">kennt eure Woche, Mila und Freizeit</span>
          </span>
          <button type="button" className="mgr__new" onClick={() => setMsgs([])} disabled={busy || !msgs.length}>Neues Gespräch</button>
          <button type="button" className="mgs__close" onClick={() => setOpen(false)} aria-label="Schließen">×</button>
        </header>

        <div className="mgs__list">
          {msgs.length === 0 && (
            <div className="mgr__empty">
              <span className="mgr__hello">Was soll ich für euch erledigen?</span>
              <span className="hint">Tippen, diktieren oder ein Foto schicken. Ich schlage vor, ihr sagt Okay.</span>
              <div className="mgr__chips">
                {CHIPS.map((c) => (
                  <button key={c} type="button" className="mgr__chip" onClick={() => void send(c)}>{c}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={'mgr__row mgr__row--' + m.role}>
              {m.text && <div className={'mgr__bubble mgr__bubble--' + m.role}>{m.photo ? '📷 ' : ''}{m.text}</div>}
              {m.proposals && m.proposals.length > 0 && (
                <div className={'mgr__card mgs__card' + (m.state !== 'open' ? ' mgr__card--done' : '')}>
                  <span className="mgr__cardhead">{m.state === 'applied' ? 'Ausgeführt' : m.state === 'cancelled' ? 'Nicht ausgeführt' : 'Ich würde'}</span>
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
                      <button type="button" className="mgr__ghost mgs__cancel" disabled={busy} onClick={() => update(m.id, { state: 'cancelled' })}>Abbrechen</button>
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

        {hint && <span className="mgs__hint">{hint}</span>}
        {photo && (
          <div className="mgs__photo">
            <img src={photo.url} alt="Foto für diese Anfrage" />
            <span className="hint">Nur für diese Anfrage, wird nicht gespeichert.</span>
            <button type="button" className="mgs__close" onClick={() => setPhoto(null)} aria-label="Foto entfernen">×</button>
          </div>
        )}
        <form
          className="mgs__input"
          onSubmit={(e) => {
            e.preventDefault()
            void send(text)
          }}
        >
          <button type="button" className="mgs__cam" onClick={() => fileRef.current?.click()} aria-label="Foto aufnehmen oder auswählen" disabled={busy}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" />
              <circle cx="12" cy="13.2" r="3.4" />
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          <textarea
            ref={inputRef}
            className="mgr__field"
            rows={1}
            value={text}
            placeholder={photo ? 'Was soll ich damit machen?' : 'Sag einfach, was ansteht …'}
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
          <button type="submit" className="mgr__send" disabled={busy || (!text.trim() && !photo)} aria-label="Senden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Knopf in der Pille: Antippen = Blatt, Gedrückthalten = sprechen
// ---------------------------------------------------------------------------
const HOLD_MS = 320
const DICTATE_HINT = 'Tipp unten auf der Tastatur aufs Mikrofon und sprich.'

export function ManagerButton() {
  const [phase, setPhase] = useState<'idle' | 'listening'>('idle')
  const [heard, setHeard] = useState('')
  const timer = useRef<number | null>(null)
  const held = useRef(false)
  const rec = useRef<Listening | null>(null)

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  const down = (e: RPointerEvent) => {
    if (e.button !== 0) return
    held.current = false
    clear()
    timer.current = window.setTimeout(() => {
      held.current = true
      navigator.vibrate?.(12)
      setHeard('')
      setPhase('listening')
      // Spracherkennung, wenn das Gerät sie erlaubt; sonst beim Loslassen Blatt + Tastatur-Diktat
      if (speechState() === 'off') return
      rec.current = listen(
        (t) => setHeard(t),
        (t) => {
          rec.current = null
          setPhase('idle')
          managerBus.open(t || undefined)
        },
        () => {
          // Geht hier nicht (z. B. Homescreen-App): Blatt öffnen; ab jetzt direkt Tastatur-Diktat
          rec.current = null
          setPhase('idle')
          managerBus.open()
        },
      )
    }, HOLD_MS)
  }
  const up = () => {
    clear()
    if (!held.current) return managerBus.open() // kurz getippt
    held.current = false
    if (rec.current) {
      rec.current.stop() // Ergebnis kommt in onDone
      return
    }
    setPhase('idle')
    // Ersatz: Blatt mit fokussiertem Feld, Diktat über die Tastatur (noch in derselben Geste)
    managerBus.openAndFocus(DICTATE_HINT)
  }
  const cancel = () => {
    clear()
    held.current = false
    if (rec.current) rec.current.stop()
    else setPhase('idle')
  }

  return (
    <>
      <button
        type="button"
        className={'pill__mgr' + (phase === 'listening' ? ' pill__mgr--on' : '')}
        aria-label="Casa-Manager (gedrückt halten zum Sprechen)"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            managerBus.open()
          }
        }}
      >
        <BubbleIcon />
      </button>
      {phase === 'listening' && (
        <div className="listen" role="status" aria-live="polite">
          <span className="listen__wave" aria-hidden><i /><i /><i /><i /><i /></span>
          <span className="listen__text">{heard || (speechState() === 'off' ? 'Loslassen, dann diktieren …' : 'Ich höre zu …')}</span>
        </div>
      )}
    </>
  )
}
