import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCasa } from '../state/HouseholdContext'
import { Toggle } from '../components/ui'
import { SetPassword } from './SetPassword'
import { currentPushSubscription, isIOS, isStandalone, permissionState, pushSupported } from '../lib/push'

export function Einstellungen() {
  const { me, user, settings, updateSettings, signOut, isDemo, household, enablePush, disablePush, sendTestPush } = useCasa()
  const darkAuto = settings?.dark_mode_auto ?? true
  const [pwOpen, setPwOpen] = useState(false)
  const [pwDone, setPwDone] = useState(false)

  // --- Mitteilungen ---
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const perm = permissionState()
  const supported = pushSupported()
  const needsHomeScreen = isIOS() && !isStandalone()

  useEffect(() => {
    currentPushSubscription().then((s) => setSubscribed(!!s))
  }, [])

  async function onEnable() {
    setBusy(true)
    setPushMsg(null)
    try {
      await enablePush()
      setSubscribed(true)
      setPushMsg('Mitteilungen sind auf diesem Gerät an.')
    } catch (e) {
      setPushMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function onDisable() {
    setBusy(true)
    setPushMsg(null)
    try {
      await disablePush()
      setSubscribed(false)
      setPushMsg('Auf diesem Gerät abgeschaltet.')
    } catch (e) {
      setPushMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function onTest() {
    setBusy(true)
    setPushMsg(null)
    try {
      await sendTestPush()
      setPushMsg('Test ist unterwegs. Sie kommt in ein paar Sekunden an, auch wenn die App geschlossen ist.')
    } catch (e) {
      setPushMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const t5 = (t: string | undefined | null) => (t ?? '').slice(0, 5)

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

      {/* ---------- Mitteilungen ---------- */}
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="label">Mitteilungen</span>

        {needsHomeScreen && (
          <p className="hint hint--brown">
            Auf dem iPhone kommen Mitteilungen nur an, wenn Casa vom Home-Bildschirm gestartet wird: in Safari auf Teilen → „Zum Home-Bildschirm“, dann von dort öffnen.
          </p>
        )}
        {!supported && !needsHomeScreen && <p className="hint">Dieser Browser kann keine Mitteilungen.</p>}
        {supported && perm === 'denied' && (
          <p className="hint hint--brown">Mitteilungen sind für Casa gesperrt. Das lässt sich nur in den Einstellungen des Geräts wieder einschalten (Mitteilungen → Casa).</p>
        )}

        {supported && perm !== 'denied' && (
          <div className="stack">
            {subscribed ? (
              <>
                <p className="hand hand--navy" style={{ fontSize: 23 }}>Auf diesem Gerät an.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--ghost" style={{ width: 'auto', padding: '0 20px', height: 46 }} disabled={busy} onClick={onTest}>Test-Mitteilung senden</button>
                  <button type="button" className="link" disabled={busy} onClick={onDisable}>Hier abschalten</button>
                </div>
              </>
            ) : (
              <button type="button" className="btn" disabled={busy || subscribed === null} onClick={onEnable}>Mitteilungen aktivieren</button>
            )}
            {pushMsg && <p className="hint">{pushMsg}</p>}
            {isDemo && <p className="hint">Im Demo-Modus gibt es keine Mitteilungen.</p>}
          </div>
        )}

        <p className="hint">
          Du bekommst eine Mitteilung, wenn {me?.display_name === 'Anna' ? 'Max' : 'Anna'} etwas für dich einträgt oder ändert. Nie für eigene Einträge, nie fürs Abhaken.
        </p>
      </div>

      {/* ---------- Morgenbriefing ---------- */}
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="label">Morgenbriefing</span>
        <div className="between" style={{ justifyContent: 'flex-start', gap: 14 }}>
          <input
            className="input-ui"
            type="time"
            value={t5(settings?.briefing_time) || '07:00'}
            onChange={(e) => e.target.value && updateSettings({ briefing_time: e.target.value })}
            style={{ minWidth: 130 }}
            aria-label="Uhrzeit Morgenbriefing"
          />
          <span className="hint">heutige Termine und fällige Aufgaben, dazu was morgen ansteht</span>
        </div>
        <p className="hint">Entfällt, wenn du Casa an dem Tag vorher schon geöffnet hast.</p>
      </div>

      {/* ---------- Ruhezeiten ---------- */}
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 4 }}>
        <Toggle
          on={settings?.quiet_enabled ?? false}
          onChange={(v) => updateSettings({ quiet_enabled: v })}
          label="Ruhezeit"
          hint="In der Ruhezeit bleibt das Gerät still. Was anfällt, kommt danach gesammelt."
        />
        {settings?.quiet_enabled && (
          <div className="between" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <span className="hint">von</span>
            <input className="input-ui" type="time" value={t5(settings.quiet_hours_start)} onChange={(e) => e.target.value && updateSettings({ quiet_hours_start: e.target.value })} style={{ minWidth: 120 }} aria-label="Ruhe von" />
            <span className="hint">bis</span>
            <input className="input-ui" type="time" value={t5(settings.quiet_hours_end)} onChange={(e) => e.target.value && updateSettings({ quiet_hours_end: e.target.value })} style={{ minWidth: 120 }} aria-label="Ruhe bis" />
          </div>
        )}
      </div>

      {/* ---------- Dunkelmodus ---------- */}
      <div>
        <Toggle
          on={darkAuto}
          onChange={(v) => updateSettings({ dark_mode_auto: v })}
          label="Ab 20 Uhr dunkles Notizbuch"
          hint="Abends wird das Papier dunkel, die Tinte hell. Morgens um 6 wieder hell."
        />
      </div>

      {/* ---------- Passwort ---------- */}
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="label">Passwort</span>
        {pwDone && <p className="hand hand--navy" style={{ fontSize: 22 }}>Passwort geändert.</p>}
        {!pwOpen ? (
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setPwOpen(true); setPwDone(false) }}>Passwort ändern</button>
        ) : (
          <SetPassword mode="change" onDone={() => { setPwOpen(false); setPwDone(true) }} />
        )}
      </div>

      <div className="spacer" />

      {isDemo && <p className="hint hint--brown">Demo-Modus: Die Daten liegen nur in diesem Browser.</p>}

      <button type="button" className="btn btn--ghost" onClick={signOut}>Abmelden</button>
    </div>
  )
}
