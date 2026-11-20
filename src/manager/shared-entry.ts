// Einstieg für die Edge Function „manager“: dieselbe Rechnung wie in der App (Einkaufszettel, Freizeit-Termin).
// Bündeln mit `npm run build:manager` → supabase/functions/manager/shared.js
export { shoppingFor, shortName } from '../mila/engine'
export { variantShopping } from '../mila/recipe-view'
export { weekKey } from '../mila/week-list'
export { tippEvent } from '../lib/freizeit'
export { guessValerie, watchNote } from '../lib/valerie'
