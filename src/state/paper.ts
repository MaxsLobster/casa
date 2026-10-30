import { useEffect, useState } from 'react'

// Papier-Look (Analog): pro Gerät, standardmäßig an. Wird in index.html vor dem ersten Bild gesetzt.
const KEY = 'casa.paper'
const EVENT = 'casa:paper'

export function paperOn(): boolean {
  return document.documentElement.getAttribute('data-paper') !== 'off'
}

export function setPaper(on: boolean) {
  document.documentElement.setAttribute('data-paper', on ? 'on' : 'off')
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* egal */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function usePaper(): boolean {
  const [on, setOn] = useState(paperOn)
  useEffect(() => {
    const h = () => setOn(paperOn())
    window.addEventListener(EVENT, h)
    return () => window.removeEventListener(EVENT, h)
  }, [])
  return on
}
