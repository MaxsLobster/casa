// Mila · nach links wischen → „Entfernen“, danach kurz „Rückgängig“.
// Ein Tipp auf den Inhalt funktioniert weiter; wer nur ein wenig zieht, löst nichts aus.
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react'

const OPEN = 96

export function SwipeRemove({ children, onRemove, label = 'Entfernen', className }: { children: ReactNode; onRemove: () => void; label?: string; className?: string }) {
  const [x, setX] = useState(0)
  const [open, setOpen] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; horiz: boolean | null } | null>(null)
  const moved = useRef(false)
  const cur = useRef(0)

  function down(e: RPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('.sr__btn')) return
    start.current = { x: e.clientX, y: e.clientY, base: open ? -OPEN : 0, horiz: null }
    cur.current = open ? -OPEN : 0
    moved.current = false
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.horiz === null && Math.hypot(dx, dy) > 8) {
      s.horiz = Math.abs(dx) > Math.abs(dy)
      if (s.horiz) e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (!s.horiz) return
    moved.current = true
    cur.current = Math.min(0, Math.max(-OPEN - 30, s.base + dx))
    setX(cur.current)
  }
  function up() {
    const s = start.current
    start.current = null
    if (!s || !s.horiz) return
    const isOpen = cur.current < -OPEN / 2
    setOpen(isOpen)
    setX(isOpen ? -OPEN : 0)
  }
  // Nach dem Ziehen keinen Tipp auf den Inhalt auslösen; offen: ein Tipp schließt
  function clickCapture(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.sr__btn')) return
    if (moved.current) {
      // Klick am Ende eines Zugs: schlucken, Zustand bleibt
      e.stopPropagation()
      e.preventDefault()
      moved.current = false
      return
    }
    if (open) {
      // offen: ein Tipp auf den Inhalt schließt wieder
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
      setX(0)
    }
  }

  return (
    // „Entfernen“ liegt hinter der Zeile und ist nur beim Wischen bzw. offen sichtbar (auch bei durchsichtigen Zeilen)
    <div className={'sr' + (x !== 0 || open ? ' sr--on' : '') + (className ? ' ' + className : '')}>
      <button type="button" className="sr__btn" tabIndex={open ? 0 : -1} aria-hidden={!open} onClick={() => { setOpen(false); setX(0); onRemove() }}>
        {label}
      </button>
      <div
        className="sr__content"
        style={{ transform: `translateX(${x}px)`, transition: start.current?.horiz ? 'none' : 'transform 0.2s ease' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={clickCapture}
      >
        {children}
      </div>
    </div>
  )
}

/** Kurze Leiste „… entfernt · Rückgängig“ (8 Sekunden) */
export function useUndo() {
  const [undo, setUndo] = useState<{ name: string; run: () => Promise<void> } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 8000)
    return () => window.clearTimeout(t)
  }, [undo])
  const offer = (name: string, run: (() => Promise<void>) | null | undefined) => {
    if (run) setUndo({ name, run })
  }
  const bar = (raised = false) =>
    undo ? (
      <div className={'m-undo' + (raised ? ' m-undo--bar' : '')} role="status">
        <span className="m-undo__text">{undo.name} entfernt</span>
        <button type="button" className="m-undo__btn" onClick={() => { const u = undo; setUndo(null); void u.run() }}>Rückgängig</button>
      </div>
    ) : null
  return { offer, bar }
}
