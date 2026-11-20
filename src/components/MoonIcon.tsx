// Gezeichneter Mond (Sonstiges › Für zwischendurch)
/** Gezeichneter Mond in echter Phase: beleuchteter Anteil und Seite (zunehmend rechts, abnehmend links) */
export function MoonIcon({ fraction, waxing, label }: { fraction: number; waxing: boolean; label: string }) {
  const r = 10
  const f = Math.min(Math.max(fraction, 0), 1)
  const rx = (r * Math.abs(2 * f - 1)).toFixed(2)
  // Außenbogen auf der beleuchteten Seite, zurück über die Schattengrenze (Ellipse)
  const outer = waxing ? 1 : 0
  const back = f >= 0.5 ? outer : 1 - outer
  const d = `M12 2 A${r} ${r} 0 0 ${outer} 12 22 A${rx} ${r} 0 0 ${back} 12 2 Z`
  return (
    <svg className="moon" width="22" height="22" viewBox="0 0 24 24" role="img" aria-label={`Mond ${label}, ${Math.round(f * 100)} Prozent`}>
      <circle cx="12" cy="12" r={r} className="moon__dark" />
      {f > 0.01 && <path d={d} className="moon__lit" />}
      <circle cx="12" cy="12" r={r} fill="none" className="moon__rim" strokeWidth="0.8" />
    </svg>
  )
}
