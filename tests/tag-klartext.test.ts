// Teil 2: Tageskarte und Woche in Klartext
import { describe, expect, it } from 'vitest'
import { dayWord, daySegments, segText, valerieDay } from '../src/lib/day'
import { NO_EFFECTS, type DayEffects } from '../src/lib/effects'
import type { DayState } from '../src/lib/week'
import type { Member, SlotRequest } from '../src/lib/types'

const max = { id: 'm', display_name: 'Max', role: 'partner' } as Member
const anna = { id: 'a', display_name: 'Anna', role: 'partner' } as Member
const v = { me: max, members: [max, anna] }
const slot = (s: string, value: string | null, at: string | null = null, overridden = false) => ({ slot: s, value, at, is_open: false, note: null, overridden }) as never
const normal: DayState = { valerie_bringen: slot('valerie_bringen', 'Anna'), valerie_holen: slot('valerie_holen', 'Max', '14:00:00'), abend_essen: { slot: 'abend_essen', value: null, at: null, is_open: true, note: null, overridden: false }, abend_bett: { slot: 'abend_bett', value: null, at: null, is_open: true, note: null, overridden: false } }
const fx = (p: Partial<DayEffects>): DayEffects => ({ ...NO_EFFECTS, away: [], ...p })

describe('Woche in Klartext', () => {
  it('eine Zeile wie in der Normalwoche', () => {
    expect(segText(daySegments('2026-11-20', normal, fx({}), v, [], []))).toBe('Anna bringt · du holst 14 Uhr · Abend offen')
  })
  it('offene Anfrage steht direkt in der Zeile', () => {
    const r = { id: 'r', date: '2026-11-20', slot: 'valerie_holen', status: 'offen', from_member_id: 'm', to_member_id: 'a' } as SlotRequest
    expect(segText(daySegments('2026-11-20', normal, fx({}), v, [], [r]))).toContain('Holen: Anna gefragt')
  })
})

describe('Tageskarte: Ausnahme ersetzt die Normalwoche', () => {
  const kita = { title: 'Valerie krank', base_id: 'e' } as never
  it('Kita zu ohne Person fragt „wer hat sie?“', () => {
    const vd = valerieDay('2026-11-23', { valerie_tag: { slot: 'valerie_tag', value: null, at: null, is_open: true, note: null, overridden: false } }, fx({ kitaZu: kita }), v, [], [])
    expect(vd.headline).toBe('Valerie krank · wer hat sie?')
    expect(vd.needsWho).toBe(true)
  })
  it('Kita zu mit Person', () => {
    const vd = valerieDay('2026-11-23', { valerie_tag: slot('valerie_tag', 'Anna', null, true) }, fx({ kitaZu: kita }), v, [], [])
    expect(vd.headline).toBe('Valerie krank · Anna hat sie')
  })
  it('normaler Tag: eigene Zeile erkennt „mine“ für „Kannst du übernehmen?“', () => {
    const vd = valerieDay('2026-11-20', normal, fx({}), v, [], [])
    expect(vd.rows.map((r) => [r.label, r.text, r.mine])).toEqual([['Bringen', 'Anna bringt', false], ['Holen', 'Du holst', true]])
  })
})

describe('Ein Tag, ein Wort', () => {
  it('„Morgen · Fr“ statt „Morgen“ und „Freitag“', () => {
    expect(dayWord('2026-11-20', '2026-11-19')).toBe('Morgen · Fr')
    expect(dayWord('2026-11-19', '2026-11-19')).toBe('Heute')
    expect(dayWord('2026-11-24', '2026-11-19')).toBe('Di 24.11.')
  })
})
