import { useEffect, useState } from 'react'

// Diagnose „Test oberer Rand“: kräftige Streifen ganz oben, über allem. Pro Gerät, normalerweise aus.
const KEY = 'casa.topTest'
const EVENT = 'casa:topTest'

export function topTestOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setTopTest(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* egal */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useTopTest(): boolean {
  const [on, setOn] = useState(topTestOn)
  useEffect(() => {
    const h = () => setOn(topTestOn())
    window.addEventListener(EVENT, h)
    return () => window.removeEventListener(EVENT, h)
  }, [])
  return on
}
