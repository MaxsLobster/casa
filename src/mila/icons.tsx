// Dünne Linien-Symbole für Mila (keine Emojis)
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Topf mit Deckel und Dampf: Einstieg in Mila */
export function PotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden>
      <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2" />
    </svg>
  )
}

const T = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Platzhalter-Kacheln: Thermomix-Topf, Pfanne, Schüssel, Grill */
export function TileIcon({ kind, size = 40 }: { kind: 'tm' | 'pan' | 'bowl' | 'grill'; size?: number }) {
  if (kind === 'tm')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...T} aria-hidden>
        <path d="M7 5h10l-1 13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
        <path d="M17 8h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2.3" />
        <path d="M6 5h12M10 14l2 2 2-2" />
      </svg>
    )
  if (kind === 'grill')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...T} aria-hidden>
        <ellipse cx="12" cy="13" rx="7" ry="7.5" />
        <path d="M5 11h14M12 3v2.5M9 21l-1.5 1.5M15 21l1.5 1.5" />
      </svg>
    )
  if (kind === 'pan')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...T} aria-hidden>
        <circle cx="10" cy="13" r="7" />
        <circle cx="10" cy="13" r="3" />
        <path d="M17 13h5" />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...T} aria-hidden>
      <path d="M3 11h18a9 9 0 0 1-18 0z" />
      <path d="M14 4l-3 7M18 5l-4 6" />
    </svg>
  )
}

export function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  )
}

export function PlusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
