// Nachzug „Wer hat Valerie?“: Erkennen, Doppeltes, Aufpassen
import { describe, expect, it } from 'vitest'
import { guessValerie, replaceQuestion, valerieConflicts, valerieEntries, watchFrom, watchNote, coveredEntryIds } from '../src/lib/valerie'
import { daySegments, segText, valerieDay } from '../src/lib/day'
import { NO_EFFECTS } from '../src/lib/effects'
import type { DayState } from '../src/lib/week'
import type { Member } from '../src/lib/types'

const max = { id: 'm', display_name: 'Max', role: 'partner' } as Member
const anna = { id: 'a', display_name: 'Anna', role: 'partner' } as Member
const v = { me: max, members: [max, anna] }
const sl = (slot: string, value: string | null, at: string | null = null, extra: object = {}) => ({ slot, value, at, is_open: false, note: null, overridden: false, ...extra }) as never
const fx = { ...NO_EFFECTS, away: [] }
const day: DayState = { valerie_bringen: sl('valerie_bringen', 'Max'), valerie_holen: sl('valerie_holen', 'Anna', '14:00') }
const theresa = { id: 'p1', name: 'Theresa' }

describe('Erkennen beim Eintragen', () => {
  it('erkennt Holen, Bringen, Aufpassen', () => {
    expect(guessValerie('Theresa holt Valerie')).toMatchObject({ slot: 'valerie_holen', who: 'Theresa', watch: false })
    expect(guessValerie('Oma passt auf')).toMatchObject({ slot: 'valerie_holen', who: 'Oma', watch: true })
    expect(guessValerie('Opa bringt sie')).toMatchObject({ slot: 'valerie_bringen', who: 'Opa' })
    expect(guessValerie('Theresa holt Valerie ab und passt auf sie auf')).toMatchObject({ slot: 'valerie_holen', who: 'Theresa', watch: true, until: null })
    expect(guessValerie('Oma holt Valerie, passt auf bis 18 Uhr')).toMatchObject({ who: 'Oma', watch: true, until: '18:00' })
    expect(guessValerie('Valerie wird von Oma abgeholt')).toMatchObject({ slot: 'valerie_holen', who: 'Oma' })
  })
  it('lässt Normales in Ruhe', () => {
    expect(guessValerie('Paket bei der Post holen')).toBeNull()
    expect(guessValerie('Max bringt Müll raus')).toBeNull()
    expect(guessValerie('Anna bringt Valerie ins Bett')).toBeNull()
    expect(guessValerie('Zahnarzt')).toBeNull()
    expect(guessValerie('Kuchen holen')).toBeNull()
  })
  it('fragt nur, wenn es etwas zu ersetzen gibt', () => {
    const g = guessValerie('Theresa holt Valerie')!
    expect(replaceQuestion(day, g, 'Theresa')?.slot).toBe('valerie_holen')
    expect(replaceQuestion(day, g, 'Anna')).toBeNull()
    expect(replaceQuestion({}, g, 'Theresa')).toBeNull() // Wochenende / Kita zu
  })
})

describe('Doppeltes sichtbar machen', () => {
  const ev = { id: 'e1', base_id: 'e1', title: 'Theresa holt Valerie ab und passt auf sie auf', start_time: null, person_id: 'p1', member_id: null, effect: 'termin', is_repeat: false, occ_date: '2026-11-20', occ_end: '2026-11-20' }
  it('Normalwoche Anna und Termin Theresa → Wer holt? Anna · Theresa', () => {
    const entries = valerieEntries('2026-11-20', [ev], [], [theresa])
    const c = valerieConflicts(day, entries)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ question: 'Wer holt?', names: ['Anna', 'Theresa'], current: 'Anna' })
    expect(c[0].entries[0].note).toBe('passt auf')
    expect(segText(daySegments('2026-11-20', day, fx, v, [], [], c))).toBe('Du bringst · Wer holt? Anna · Theresa')
    expect(coveredEntryIds(day, entries).has('e1')).toBe(true)
  })
  it('geklärte, wiederholte und gleiche Person sind kein Konflikt', () => {
    expect(valerieConflicts(day, valerieEntries('2026-11-20', [{ ...ev, valerie_cleared: true }], [], [theresa]))).toHaveLength(0)
    expect(valerieConflicts(day, valerieEntries('2026-11-20', [{ ...ev, is_repeat: true }], [], [theresa]))).toHaveLength(0)
    const decided: DayState = { ...day, valerie_holen: sl('valerie_holen', 'Theresa', '14:00', { overridden: true }) }
    expect(valerieConflicts(decided, valerieEntries('2026-11-20', [ev], [], [theresa]))).toHaveLength(0)
  })
  it('zwei Einträge mit verschiedenen Personen', () => {
    const t = { id: 't1', title: 'Oma holt Valerie', due_date: '2026-11-20', status: 'offen', owner_member_id: null }
    const c = valerieConflicts(day, valerieEntries('2026-11-20', [ev], [t], [theresa]))
    expect(c[0].names).toEqual(['Anna', 'Theresa', 'Oma'])
  })
})

describe('Aufpassen mitdenken', () => {
  it('Zusatz schreiben und lesen', () => {
    expect(watchNote('18:00')).toBe('passt auf bis 18 Uhr')
    expect(watchNote('18:30')).toBe('passt auf bis 18:30 Uhr')
    expect(watchFrom('passt auf bis 18 Uhr')).toEqual({ watch: true, until: '18:00' })
    expect(watchFrom('Schuhe mitgeben')).toEqual({ watch: false, until: null })
  })
  it('Tageskarte und Woche zeigen „passt auf bis 18 Uhr“', () => {
    const st: DayState = { ...day, valerie_holen: sl('valerie_holen', 'Theresa', '14:00', { overridden: true, note: 'passt auf bis 18 Uhr' }) }
    const r = valerieDay('2026-11-20', st, fx, v, [], []).rows.find((x) => x.slot === 'valerie_holen')!
    expect(r).toMatchObject({ text: 'Theresa holt', at: '14:00', watch: 'passt auf bis 18 Uhr', until: '18:00' })
    expect(segText(daySegments('2026-11-20', st, fx, v, [], []))).toBe('Du bringst · Theresa holt 14 Uhr, passt auf bis 18 Uhr')
  })
})
