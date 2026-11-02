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
  store.insertSync('settings', { member_id: DEMO_MAX_ID, dark_mode_auto: true, quiet_hours_start: '21:00', quiet_hours_end: '07:00', quiet_enabled: false, briefing_time: '07:00', last_opened_at: null, show_legend: true })
  store.insertSync('settings', { member_id: DEMO_ANNA_ID, dark_mode_auto: true, quiet_hours_start: '21:00', quiet_hours_end: '07:00', quiet_enabled: false, briefing_time: '07:00', last_opened_at: null, show_legend: true })
  store.insertSync('people', { household_id: DEMO_HOUSEHOLD_ID, name: 'Oma', kind: 'betreuung', sort: 1 })
  store.insertSync('people', { household_id: DEMO_HOUSEHOLD_ID, name: 'Theresa', kind: 'betreuung', sort: 2 })
  for (const [weekday, slot, value, at, is_open, note] of NORMAL_WEEK) {
    store.insertSync('normal_week', { household_id: DEMO_HOUSEHOLD_ID, weekday, slot, value, at, is_open, note })
  }
  seedAnchor(store)
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
    phase: 'testen',
    notes: 'Kein 08/15-Bürokomplex, es muss inspirieren. Am liebsten Prien oder Rosenheim. Erst als Test, dann entscheiden.',
    ask_next: false,
    moved_at: '2026-10-28T10:00:00.000Z',
    archived_at: null,
    created_by: DEMO_MAX_ID,
    updated_by: DEMO_MAX_ID,
  })
  store.insertSync('tasks', { household_id: H, title: 'Selbst einen Vormittag im Coworking arbeiten', owner_member_id: DEMO_MAX_ID, due_date: fri, status: 'offen', note: null, created_by: DEMO_MAX_ID, updated_by: DEMO_MAX_ID, done_at: null, repeat: null, repeat_until: null, anchor_id: A, is_step: true })
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
