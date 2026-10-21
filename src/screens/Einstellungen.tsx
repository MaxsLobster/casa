import { Link } from 'react-router-dom'
import { useCasa } from '../state/HouseholdContext'
import { Toggle } from '../components/ui'

export function Einstellungen() {
  const { me, user, settings, updateSettings, signOut, isDemo, household } = useCasa()
  const darkAuto = settings?.dark_mode_auto ?? true
  return (
    <div className="page" style={{ gap: 18 }}>
      <div className="between">
        <header className="stack stack--tight">
          <span className="kicker">{household?.name ?? 'Casa'}</span>
          <h1 className="h1">Einstellungen</h1>
        </header>
        <Link to="/heute" className="link">Zurück</Link>
      </div>

      <div className="stack stack--tight">
        <span className="label">Angemeldet als</span>
        <span className="hand hand--navy">{me?.display_name}</span>
        <span className="hint">{user?.email}</span>
      </div>

      <div>
        <Toggle
          on={darkAuto}
          onChange={(v) => updateSettings({ dark_mode_auto: v })}
          label="Ab 20 Uhr dunkles Notizbuch"
          hint="Abends wird das Papier dunkel, die Tinte hell. Morgens um 6 wieder hell."
        />
      </div>

      <div className="stack stack--tight" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="label">Ruhezeiten</span>
        <span className="hint">Mitteilungen kommen in Phase 3. Standard: nachts still, 21 bis 7 Uhr.</span>
      </div>

      <div className="spacer" />

      {isDemo && <p className="hint hint--brown">Demo-Modus: Die Daten liegen nur in diesem Browser. Mit Supabase-Zugangsdaten (siehe SETUP.md) teilt ihr euch die Daten.</p>}

      <button type="button" className="btn btn--ghost" onClick={signOut}>Abmelden</button>
    </div>
  )
}
