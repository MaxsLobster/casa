import { useEffect, useState } from 'react'

const KEY = 'casa.darkAuto'

export function isNight(d = new Date()): boolean {
  const h = d.getHours()
  return h >= 20 || h < 6
}

function apply(dark: boolean) {
  const root = document.documentElement
  if (dark) root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#182036' : '#F4F1EA')
}

/** Ab 20 Uhr dunkles Notizbuch, wenn in den Einstellungen nicht abgeschaltet. */
export function useTheme(darkAuto: boolean | null) {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')
  useEffect(() => {
    if (darkAuto !== null) {
      try {
        localStorage.setItem(KEY, darkAuto ? 'on' : 'off')
      } catch {
        /* egal */
      }
    }
    const tick = () => {
      const auto = darkAuto ?? localStorage.getItem(KEY) !== 'off'
      const next = auto && isNight()
      setDark(next)
      apply(next)
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [darkAuto])
  return dark
}
