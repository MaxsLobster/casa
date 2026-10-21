// Startdaten für den Demo-Modus – entspricht supabase/migrations/*_seed.sql
import type { LocalStore } from './store'
import type { Slot } from './types'

export const DEMO_HOUSEHOLD_ID = '00000000-0000-0000-0000-00000000000a'
export const DEMO_MAX_ID = '00000000-0000-0000-0000-00000000000b'
export const DEMO_ANNA_ID = '00000000-0000-0000-0000-00000000000c'

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
  store.insertSync('settings', { member_id: DEMO_MAX_ID, dark_mode_auto: true, quiet_hours_start: '21:00', quiet_hours_end: '07:00' })
  store.insertSync('settings', { member_id: DEMO_ANNA_ID, dark_mode_auto: true, quiet_hours_start: '21:00', quiet_hours_end: '07:00' })
  for (const [weekday, slot, value, at, is_open, note] of NORMAL_WEEK) {
    store.insertSync('normal_week', { household_id: DEMO_HOUSEHOLD_ID, weekday, slot, value, at, is_open, note })
  }
}
