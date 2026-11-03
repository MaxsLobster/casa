// Startdaten für den Demo-Modus – entspricht supabase/migrations/*_seed.sql
import type { LocalStore } from './store'
import type { Slot } from './types'

export const DEMO_HOUSEHOLD_ID = '00000000-0000-0000-0000-00000000000a'
export const DEMO_MAX_ID = '00000000-0000-0000-0000-00000000000b'
export const DEMO_ANNA_ID = '00000000-0000-0000-0000-00000000000c'
export const DEMO_ANCHOR_ID = '00000000-0000-0000-0000-00000000000d'

type Row = [number, Slot, string | null, string | null, boolean, string | null]

export const NORMAL_WEEK: Row[] = [
  [1, 'valerie_bringen', 'Max', null, false, null],
  [1, 'valerie_holen', 'Oma', '14:00', false, null],
  [1, 'anna_arbeit', '8 Std.', null, false, null],
  [1, 'abend_essen', 'Max', null, false, null],
  [1, 'abend_bett', 'Anna', null, false, null],

  [2, 'valerie_bringen', 'Max', null, false, null],
  [2, 'valerie_holen', 'Anna', '14:00', false, null],
  [2, 'anna_arbeit', '4 Std.', null, false, null],
  [2, 'abend_essen', 'Anna', null, false, null],
  [2, 'abend_bett', 'Anna', null, false, 'vorerst'],

  [3, 'valerie_bringen', 'Max', null, false, null],
  [3, 'valerie_holen', 'Theresa', '14:00', false, 'Kann sie nicht, übernimmt Max.'],
  [3, 'anna_arbeit', '8 Std.', null, false, null],
  [3, 'abend_essen', null, null, true, 'wer kocht?'],
  [3, 'abend_bett', 'Anna', null, false, null],

  [4, 'valerie_bringen', 'Max', null, false, null],
  [4, 'valerie_holen', 'Anna', '13:00', false, null],
  [4, 'nachmittag', 'Turnen 15–16 Uhr, danach Freunde', null, false, null],
  [4, 'abend_essen', 'bei Freunden', null, false, null],
  [4, 'abend_bett', 'Anna', null, false, null],

  [5, 'valerie_bringen', 'Max', null, false, null],
  [5, 'valerie_holen', 'Anna', '14:00', false, null],
  [5, 'anna_arbeit', 'frei', null, false, null],
  [5, 'abend_essen', null, null, true, 'Essen'],
  [5, 'abend_bett', null, null, true, 'Bettgehen'],

  [6, 'wochenende', 'Ein Familientag, ein Tag mit geteilter Betreuung, flexibel', null, true, 'welcher Tag ist Familientag?'],
  [7, 'wochenende', 'Ein Familientag, ein Tag mit geteilter Betreuung, flexibel', null, true, 'welcher Tag ist Familientag?'],
]

export function seedLocal(store: LocalStore) {
  store.insertSync('households', { id: DEMO_HOUSEHOLD_ID, name: 'Casa' })
  store.insertSync('members', { id: DEMO_MAX_ID, household_id: DEMO_HOUSEHOLD_ID, user_id: 'demo-max', email: 'max@beispiel.de', display_name: 'Max', role: 'partner' })
  store.insertSync('members', { id: DEMO_ANNA_ID, household_id: DEMO_HOUSEHOLD_ID, user_id: 'demo-anna', email: 'anna@beispiel.de', display_name: 'Anna', role: 'partner' })
  store.insertSync('settings', { member_id: DEMO_MAX_ID, dark_mode_auto: true, quiet_hours_start: '21:00', quiet_hours_end: '07:00', quiet_enabled: false, briefing_time: '07:00', last_opened_at: null, show_legend: true, workday_on: null, mwf_notify: 'aus' })
  store.insertSync('settings', { member_id: DEMO_ANNA_ID, dark_mode_auto: true, quiet_hours_start: '21:00', quiet_hours_end: '07:00', quiet_enabled: false, briefing_time: '07:00', last_opened_at: null, show_legend: true, workday_on: null, mwf_notify: 'aus' })
  store.insertSync('people', { household_id: DEMO_HOUSEHOLD_ID, name: 'Oma', kind: 'betreuung', sort: 1 })
  store.insertSync('people', { household_id: DEMO_HOUSEHOLD_ID, name: 'Theresa', kind: 'betreuung', sort: 2 })
  for (const [weekday, slot, value, at, is_open, note] of NORMAL_WEEK) {
    store.insertSync('normal_week', { household_id: DEMO_HOUSEHOLD_ID, weekday, slot, value, at, is_open, note })
  }
  seedAnchor(store)
  seedMwf(store)
}

/** Beispiel-Anker „Externes Büro" (wie in der echten Datenbank) */
function seedAnchor(store: LocalStore) {
  const H = DEMO_HOUSEHOLD_ID
  const A = DEMO_ANCHOR_ID
  const fri = (() => {
    const d = new Date()
    d.setDate(d.getDate() + ((5 - (d.getDay() || 7) + 7) % 7 || 7))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  store.insertSync('anchors', {
    id: A,
    household_id: H,
    title: 'Externes Büro',
    why: 'Raus aus dem Haus, ein Ort mit Struktur zum Arbeiten und Nachdenken.',
    visibility: 'shared',
    area: 'casa',
    phase: 'testen',
    notes: 'Kein 08/15-Bürokomplex, es muss inspirieren. Am liebsten Prien oder Rosenheim. Erst als Test, dann entscheiden.',
    ask_next: false,
    moved_at: '2026-10-28T10:00:00.000Z',
    archived_at: null,
    created_by: DEMO_MAX_ID,
    updated_by: DEMO_MAX_ID,
  })
  store.insertSync('tasks', { household_id: H, title: 'Selbst einen Vormittag im Coworking arbeiten', owner_member_id: DEMO_MAX_ID, due_date: fri, status: 'offen', note: null, created_by: DEMO_MAX_ID, updated_by: DEMO_MAX_ID, done_at: null, repeat: null, repeat_until: null, anchor_id: A, is_step: true, area: 'casa', fair_id: null, template_id: null, is_running: false, is_yearly: false, is_skipped: false })
  const logs: [string, string][] = [
    ['2026-09-01T10:00:00.000Z', 'Idee: lieber Wohnung auf Zeit als Coworking, zum Arbeiten und Übernachten'],
    ['2026-09-20T10:00:00.000Z', 'Kandidat gefunden: möblierte Wohnung am Samerberg, Anfrage geschickt'],
    ['2026-10-28T10:00:00.000Z', 'Anna mietet Coworking für einen Monat, für uns beide'],
  ]
  for (const [at, text] of logs) store.insertSync('anchor_log', { household_id: H, anchor_id: A, kind: 'note', text, author_member_id: DEMO_MAX_ID, at })
  const qs = ['Coworking nach dem Monat verlängern?', 'Doch eine eigene Wohnung (Samerberg-Idee)?', 'Wie oft pro Woche will ich raus?']
  qs.forEach((text, i) => store.insertSync('anchor_questions', { household_id: H, anchor_id: A, text, resolved_at: null, sort: i, created_by: DEMO_MAX_ID }))
  store.insertSync('anchor_pins', { member_id: DEMO_MAX_ID, anchor_id: A })
}

/** Munich Watch Fair: Messen 2026/2027, Vorlage der Runde, Jahrespunkt, vier Firmen-Anker */
export const FAIR_DATES = ['2026-10-04', '2026-11-08', '2026-12-06', '2027-01-17', '2027-02-21', '2027-04-04', '2027-05-16', '2027-06-27', '2027-09-05', '2027-10-17', '2027-11-14', '2027-12-12']

type Tpl = [string, 'max' | 'anna' | null, 'start' | 'until' | 'before' | 'eve' | 'fair', number | null, boolean]
export const TEMPLATE: Tpl[] = [
  ['Kassenbuch, Zählprotokoll, Bargeld zur Bank', 'anna', 'start', null, false],
  ['Rechnungsnummern vergeben (nach Zahlungseingang)', 'anna', 'start', null, false],
  ['Offene Zahlungen nachfassen', 'anna', 'start', null, false],
  ['Kurze Nachbesprechung (was lief gut/schlecht)', null, 'start', null, false],
  ['Online-Shop für die nächste Messe freischalten', 'anna', 'start', 14, false],
  ['Instagram-Post, sobald die Tickets online sind', 'max', 'start', 12, false],
  ['Standplan-Tabelle anlegen + Saalplan-App umstellen', 'max', 'start', null, false],
  ['Saalplan groß oder klein festlegen', 'max', 'start', null, false],
  ['Anfragen beantworten, Plätze vergeben', 'max', 'until', 0, true],
  ['Halbjahres- und Jahresbucher eintragen', 'max', 'until', 14, false],
  ['Eintrittskarten und -bänder bestellen', 'max', 'before', 10, false],
  ['Rechnungen vorbereiten', 'max', 'before', 3, false],
  ['iPads vorbereiten', 'max', 'eve', 1, false],
  ['SumUp, Wechselgeld, Kasse', 'anna', 'eve', 1, false],
  ['Check-in, Rechnungen, Kontrolle wer bezahlt hat', 'anna', 'fair', 0, false],
]

export interface SeedAnchor {
  title: string
  why: string
  phase: 'idee' | 'klaeren' | 'testen' | 'entscheiden' | 'laeuft'
  step: string
  who: 'max' | 'anna' | null
  notes: string | null
  questions: string[]
  pinMax: boolean
}
export const MWF_ANCHORS: SeedAnchor[] = [
  { title: 'Version 2.0 / 2027', why: 'Firma bis zur Sommerpause 2027 übersichtlich, automatisiert, ruhiger.', phase: 'klaeren', step: 'Bausteine in eine Reihenfolge bringen', who: null, notes: 'Bausteine: Abrechnung und Bargeld 2027 (neue EU-Regeln ab Juli 2027), Anmeldung über die Homepage mit Freigabe per Klick, Preise und Regeln transparent. Erste Messe im September 2027 läuft als Version 2.0.', questions: [], pinMax: true },
  { title: 'GmbH-Umwandlung', why: 'Persönliche Haftung loswerden, nicht mehr Single Point of Failure.', phase: 'idee', step: 'Termin beim Steuerberater', who: 'max', notes: 'Bisher nichts passiert, weil die Zukunft der Firma in der Schwebe war.', questions: ['GmbH oder GmbH & Co. KG?', 'Neues Zieldatum (1.1.2027 ist nicht mehr realistisch)?', 'Mietvertrag Ballhausforum: Change-of-Control-Klausel?'], pinMax: true },
  { title: 'Zukunft der Firma & Wochenende unter einem Dach', why: 'Klar haben, welcher Weg: behalten (2.0), Mehrheit abgeben oder verkaufen – und wie Samstag (WTA) und Sonntag zusammengehören.', phase: 'klaeren', step: 'Gespräch zu zweit: welcher Weg?', who: null, notes: null, questions: [], pinMax: false },
  { title: 'Social Media & Image', why: 'Image und Aufklärung, nicht Reichweite.', phase: 'idee', step: 'Zur nächsten Messe ein Post hinter den Kulissen', who: 'max', notes: 'Instagram knapp 4.000 Follower, bisher nur ein Flyer-Post pro Messe.', questions: [], pinMax: false },
]

function seedMwf(store: LocalStore) {
  const H = DEMO_HOUSEHOLD_ID
  const who = (w: 'max' | 'anna' | null) => (w === 'max' ? DEMO_MAX_ID : w === 'anna' ? DEMO_ANNA_ID : null)
  for (const date of FAIR_DATES) store.insertSync('fairs', { household_id: H, date, note: null })
  TEMPLATE.forEach(([title, w, section, days_before, is_running], i) =>
    store.insertSync('checklist_template', { household_id: H, area: 'mwf', title, owner_member_id: who(w), section, days_before, is_running, sort: i + 1 }),
  )
  store.insertSync('tasks', { household_id: H, title: 'Marktfestsetzung', owner_member_id: DEMO_ANNA_ID, due_date: '2026-12-31', status: 'offen', note: null, created_by: DEMO_MAX_ID, updated_by: DEMO_ANNA_ID, done_at: null, repeat: null, repeat_until: null, anchor_id: null, is_step: false, area: 'mwf', fair_id: null, template_id: null, is_running: false, is_yearly: true, is_skipped: false })
  const stepDue = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  for (const a of MWF_ANCHORS) {
    const row = store.insertSync('anchors', { household_id: H, title: a.title, why: a.why, visibility: 'shared', area: 'mwf', phase: a.phase, notes: a.notes, ask_next: false, moved_at: new Date().toISOString(), archived_at: null, created_by: DEMO_MAX_ID, updated_by: DEMO_MAX_ID })
    store.insertSync('tasks', { household_id: H, title: a.step, owner_member_id: who(a.who), due_date: stepDue, status: 'offen', note: null, created_by: DEMO_MAX_ID, updated_by: DEMO_MAX_ID, done_at: null, repeat: null, repeat_until: null, anchor_id: row.id, is_step: true, area: 'mwf', fair_id: null, template_id: null, is_running: false, is_yearly: false, is_skipped: false })
    a.questions.forEach((text, i) => store.insertSync('anchor_questions', { household_id: H, anchor_id: row.id, text, resolved_at: null, sort: i, created_by: DEMO_MAX_ID }))
    if (a.pinMax) store.insertSync('anchor_pins', { member_id: DEMO_MAX_ID, anchor_id: row.id })
  }
  // Zurufe: einer von Anna an Max (ungelesen), einer von Max an Anna (gelesen)
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
  store.insertSync('shouts', { household_id: H, area: 'mwf', from_member_id: DEMO_ANNA_ID, to_member_id: DEMO_MAX_ID, text: 'Hey, der Meier kommt nächsten Sonntag', reply_to: null, read_at: null, archived_at: null, created_at: ago(2) })
  store.insertSync('shouts', { household_id: H, area: 'mwf', from_member_id: DEMO_MAX_ID, to_member_id: DEMO_ANNA_ID, text: 'Tickets sind seit heute online', reply_to: null, read_at: ago(20), archived_at: ago(20), created_at: ago(26) })
}
