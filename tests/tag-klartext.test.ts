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

import { komboDays } from '../src/mila/wahl'
import type { MilaPlanItem } from '../src/lib/types'
const pi = (id: string, p: Partial<MilaPlanItem> = {}): MilaPlanItem =>
  ({ id, household_id: 'h', plan_id: 'p', recipe_id: 'r-' + id, slot: 'abend', gruppe: 'zuerst', position: 0, art: 'frisch', portionen: 3, variante: 'original', status: 'offen', frist_bis: null, parent_id: null, geplant_am: null, gekocht_am: null, created_at: '', updated_at: '', ...p }) as MilaPlanItem

describe('Essensplan: Kombo und „Was es gibt“ aus denselben Daten', () => {
  const dates = ['2026-11-23', '2026-11-24', '2026-11-25']
  const items = [pi('a', { frist_bis: '2026-11-24' }), pi('b', { frist_bis: '2026-11-26' })]
  it('verteilt die Kombo in Kochreihenfolge auf die Tage', () => {
    const d = komboDays(dates, items, [], '2026-11-23', '2026-11-23')
    expect([d['2026-11-23'].abend?.recipeId, d['2026-11-24'].abend?.recipeId, d['2026-11-25'].abend]).toEqual(['r-a', 'r-b', undefined])
  })
  it('„auswärts“ schiebt das Gericht auf den nächsten freien Tag', () => {
    const d = komboDays(dates, items, [{ date: '2026-11-23', meal: 'abend', recipe_id: null, free_text: 'auswärts', is_leftover: false }], '2026-11-23', null)
    expect(d['2026-11-23'].abend?.mark).toBe('auswärts')
    expect(d['2026-11-24'].abend?.recipeId).toBe('r-a')
    expect(d['2026-11-25'].abend?.recipeId).toBe('r-b')
  })
  it('Reste vom Vorabend kommen mittags am nächsten Tag', () => {
    const withRest = [...items, pi('rest', { slot: 'reste', parent_id: 'a' })]
    const d = komboDays(dates, withRest, [], '2026-11-23', null)
    expect(d['2026-11-24'].mittag?.recipeId).toBe('r-rest')
    expect(d['2026-11-24'].mittag?.leftover).toBe(true)
  })
})

describe('Heute: vergangene Uhrzeiten', async () => {
  const { timePassed } = await import('../src/lib/dates')
  const at = (h: number, m = 0) => new Date(2026, 10, 20, h, m)
  it('Bringen 8:00 steht bis 8:15, danach weg', () => {
    expect(timePassed('2026-11-20', '08:00:00', at(8, 14))).toBe(false)
    expect(timePassed('2026-11-20', '08:00:00', at(8, 15))).toBe(true)
    expect(timePassed('2026-11-20', '08:00:00', at(13, 11))).toBe(true)
  })
  it('ohne Uhrzeit bleibt es stehen', () => {
    expect(timePassed('2026-11-20', null, at(23, 59))).toBe(false)
  })
})
