import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCasa, useToday } from '../state/HouseholdContext'
import { Chips, Toggle } from '../components/ui'
import { isWorkday } from '../lib/mwf'
import { setPaper, usePaper } from '../state/paper'
import { SetPassword } from './SetPassword'
import { currentPushSubscription, isIOS, isStandalone, permissionState, pushSupported } from '../lib/push'

const COUNTS = [0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Wochentag (und Uhrzeit) für den Mila-Rhythmus */
function DayTime({ label, day, time, onChange }: { label: string; day: number; time?: string; onChange: (day: number, time: string) => void }) {
  return (
    <div className="between" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
      <span className="hint" style={{ flex: "1 1 100%" }}>{label}</span>
      <select className="input-ui" value={day} onChange={(e) => onChange(Number(e.target.value), time ?? '')} aria-label={label + ': Tag'} style={{ minWidth: 76 }}>
        {WD.map((w, i) => (
          <option key={w} value={i + 1}>{w}</option>
        ))}
      </select>
      {time !== undefined && (
        <input className="input-ui" type="time" value={time} onChange={(e) => e.target.value && onChange(day, e.target.value)} aria-label={label + ': Uhrzeit'} style={{ minWidth: 110 }} />
      )}
    </div>
  )
}

export function Einstellungen() {
  const { me, user, settings, updateSettings, setWorkday, signOut, isDemo, household, enablePush, disablePush, sendTestPush, milaRhythm, saveMilaRhythm } = useCasa()
  const today = useToday()
  const darkAuto = settings?.dark_mode_auto ?? true
  const paper = usePaper()
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

      {/* ---------- Munich Watch Fair ---------- */}
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 4 }}>
        <Toggle
          on={isWorkday(settings, today)}
          onChange={(v) => setWorkday(v)}
          label="Arbeitstag heute"
          hint="An: das MWF-Symbol steht auf der Startseite, deine heute fälligen MWF-Aufgaben unter „Heute noch“. Um Mitternacht wieder aus."
        />
        <div className="stack" style={{ paddingTop: 4 }}>
          <span className="label">MWF-Mitteilungen</span>
          <Chips
            variant="date"
            options={[
              { value: 'aus', label: 'aus' },
              { value: 'briefing', label: 'nur im Morgenbriefing' },
              { value: 'sofort', label: 'sofort' },
            ]}
            value={settings?.mwf_notify ?? 'aus'}
            onChange={(v) => updateSettings({ mwf_notify: v })}
          />
          <p className="hint">Gilt für Zurufe und für Aufgaben der Firma, die der andere für dich einträgt. Bei „aus“ zeigt nur ein Punkt am MWF-Symbol ungelesene Zurufe. Rundenpunkte aus der Vorlage lösen nie eine Mitteilung aus.</p>
        </div>
      </div>

      {/* ---------- Mila ---------- */}
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="label">Mila · Wochenkarte</span>
        <div className="stack" style={{ gap: 6 }}>
          <span className="hint">Mittagessen pro Woche (Mo–Fr)</span>
          <Chips variant="date" options={COUNTS} value={String(milaRhythm.lunches)} onChange={(v) => saveMilaRhythm({ lunches: Number(v) })} />
          <span className="hint">Abendessen pro Woche (Mo–Fr)</span>
          <Chips variant="date" options={COUNTS} value={String(milaRhythm.dinners)} onChange={(v) => saveMilaRhythm({ dinners: Number(v) })} />
        </div>
        <DayTime label="Karte ab" day={milaRhythm.card_weekday} time={milaRhythm.card_time} onChange={(d, t) => saveMilaRhythm({ card_weekday: d, card_time: t })} />
        <DayTime label="Wahl schließt" day={milaRhythm.close_weekday} time={milaRhythm.close_time} onChange={(d, t) => saveMilaRhythm({ close_weekday: d, close_time: t })} />
        <DayTime label="Sonst automatisch übernehmen" day={milaRhythm.adopt_weekday} time={milaRhythm.adopt_time} onChange={(d, t) => saveMilaRhythm({ adopt_weekday: d, adopt_time: t })} />
        <DayTime label="Großer Einkauf" day={milaRhythm.shop_weekday} onChange={(d) => saveMilaRhythm({ shop_weekday: d })} />
        <DayTime label="Prep-Stunde" day={milaRhythm.prep_weekday} time={milaRhythm.prep_time} onChange={(d, t) => saveMilaRhythm({ prep_weekday: d, prep_time: t })} />
        <p className="hint">Alles in der Woche davor. Gilt ab der nächsten Karte. Mitteilungen gibt es nur, wenn sie oben an sind: wenn die Karte da ist und wenn die Woche steht.</p>
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

      {/* ---------- Papier-Look ---------- */}
      <div>
        <Toggle
          on={paper}
          onChange={setPaper}
          label="Papier-Look"
          hint="Körnung, gestanzte Löcher und raue Tinte wie in einem echten Notizbuch. Gilt für dieses Gerät. Aus, falls es hier ruckelt."
        />
      </div>

      {/* ---------- Legende ---------- */}
      {settings && !settings.show_legend && (
        <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <span className="label">Woche</span>
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => updateSettings({ show_legend: true })}>Legende wieder anzeigen</button>
        </div>
      )}

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
