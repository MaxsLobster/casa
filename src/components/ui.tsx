import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TaskStatus } from '../lib/types'

/* ---------- Pfeil ---------- */
export function Chevron({ open }: { open: boolean }) {
  return (
    <span className={'chev' + (open ? ' chev--open' : '')} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  )
}

/* ---------- Weich auf-/zuklappen ---------- */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={'collapse' + (open ? ' collapse--open' : '')} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  )
}

/* ---------- Stempel (mit Aufdrück-Effekt bei Statuswechsel) ---------- */
export function Stamp({ status, children }: { status: TaskStatus; children: ReactNode }) {
  const [press, setPress] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setPress(true)
    const t = setTimeout(() => setPress(false), 360)
    return () => clearTimeout(t)
  }, [status])
  return <span className={`stamp status-${status}` + (press ? ' stamp--press' : '')}>{children}</span>
}

/* ---------- Abhaken ---------- */
export function Check({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="check" onClick={onToggle} aria-pressed={done} aria-label={label}>
      <span className={'check__circle' + (done ? ' check__circle--done' : '')}>
        {done && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </span>
    </button>
  )
}

/* ---------- Chips ---------- */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  variant = 'who',
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  variant?: 'who' | 'date'
}) {
  return (
    <div className="chips" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={'chip' + (variant === 'date' ? ' chip--date' : '') + (on ? ' chip--on' : '')}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Reiter ---------- */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} className="tab" onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Bottom Sheet ---------- */
export function Sheet({ onClose, children, title }: { onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ---------- Schalter ---------- */
export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="stack stack--tight">
        <span className="hand" style={{ fontSize: 22 }}>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <span className={'toggle__switch' + (on ? ' toggle__switch--on' : '')} aria-hidden />
    </button>
  )
}

/* ---------- Textfeld in Handschrift, wächst mit ---------- */
export function HandInput({
  value,
  onChange,
  placeholder,
  inputRef,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  autoFocus?: boolean
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = inputRef ?? localRef
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value, ref])
  return (
    <textarea
      ref={ref}
      className="input-hand"
      rows={1}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
    />
  )
}

/* ---------- Mikrofon: nutzt die Diktierfunktion der Tastatur ---------- */
export function MicButton({ target }: { target: React.RefObject<HTMLTextAreaElement | null> }) {
  const [hint, setHint] = useState(false)
  return (
    <>
      <button
        type="button"
        className="mic"
        aria-label="Reinsprechen"
        onClick={() => {
          target.current?.focus()
          setHint(true)
          setTimeout(() => setHint(false), 4000)
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      {hint && (
        <span className="hint fade-in" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, maxWidth: 220, textAlign: 'right' }}>
          Tipp auf das Mikrofon unten auf der Tastatur und sprich.
        </span>
      )}
    </>
  )
}
