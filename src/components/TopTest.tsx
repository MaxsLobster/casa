import { useEffect, useRef, useState } from 'react'

/**
 * Diagnose für den oberen Rand: Liegt als feste Fläche ganz oben über allem (z-index 500).
 * Feines Schachbrett (2 px) über die ganze Höhe, darüber breite Farbstreifen, eine Magenta-Linie genau
 * an der Unterkante der Statusleiste. Wenn Schachbrett oder Streifen nach oben hin weich werden oder
 * unter einer glatten Fläche verschwinden, macht das iOS – unser CSS kann auf diese Fläche nicht wirken.
 */
export function TopTest() {
  const probe = useRef<HTMLDivElement>(null)
  const [inset, setInset] = useState<number | null>(null)
  useEffect(() => {
    if (!probe.current) return
    const px = parseFloat(getComputedStyle(probe.current).paddingTop)
    setInset(Number.isNaN(px) ? null : px)
  }, [])
  return (
    <div className="toptest" aria-hidden="true">
      <div ref={probe} className="toptest__probe" />
      <div className="toptest__stripes" />
      <div className="toptest__line" />
      <span className="toptest__label">
        Test oberer Rand · Inset {inset ?? '?'} px · {window.innerWidth}×{window.innerHeight}
      </span>
    </div>
  )
}
