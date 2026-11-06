// Einstieg für die Edge Function „mila-tick“: dieselbe Rechnung wie in der App.
// Bündeln mit `npm run build:mila-tick` → supabase/functions/mila-tick/engine.js
export { DEFAULT_RHYTHM, adoptWrites, cardWeek, computePlan, generateCard, menuTimes, workDays } from './engine'
export { weekKey } from './week-list'
export { fairEvents } from '../lib/mwf'
