// Kleine Armbanduhr als Zeichen für die Munich Watch Fair
export function MwfIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="6.2" />
      <path d="M12 9v3l2 1.4" />
      <path d="M9 6.2 9.6 2.5h4.8L15 6.2M9 17.8l.6 3.7h4.8l.6-3.7" />
    </svg>
  )
}
