// Tests für die Fehler aus dem UX-Test (Teil 1), damit sie nicht wiederkommen.
import { describe, expect, it } from 'vitest'
import { heuteDran, itemsOfWeek } from '../src/mila/wahl'
import { berlinDay, lastOpenedText, trackingDays, trackingText, TRACK_START } from '../src/sonstiges/useSonstiges'
import type { MilaPlanItem } from '../src/lib/types'

const item = (p: Partial<MilaPlanItem>): MilaPlanItem =>
  ({ id: 'i', household_id: 'h', plan_id: 'p', recipe_id: 'r', slot: 'abend', gruppe: 'zuerst', position: 0, art: 'frisch', portionen: 3, variante: 'original', status: 'offen', frist_bis: null, parent_id: null, geplant_am: null, gekocht_am: null, created_at: '', updated_at: '', ...p }) as MilaPlanItem

describe('Heute: Mila-Vorschlag nur aus der laufenden Woche', () => {
  const items = [item({ id: 'a', recipe_id: 'padthai' })]
  it('Kombo der nächsten Woche wird am Freitag nicht vorgeschlagen', () => {
    const next = { week: '2026-11-23', status: 'aktiv' as const, adopted_at: '2026-11-19T20:00:00Z' }
    expect(heuteDran(itemsOfWeek(next, items, '2026-11-20'), '2026-11-20').abend).toBeNull()
  })
  it('Kombo der laufenden Woche wird vorgeschlagen', () => {
    const cur = { week: '2026-11-23', status: 'aktiv' as const, adopted_at: '2026-11-19T20:00:00Z' }
    expect(heuteDran(itemsOfWeek(cur, items, '2026-11-25'), '2026-11-25').abend?.recipe_id).toBe('padthai')
  })
  it('verworfene oder nicht übernommene Kombo wird nie vorgeschlagen', () => {
    expect(itemsOfWeek({ week: '2026-11-16', status: 'verworfen', adopted_at: '2026-11-15T20:00:00Z' }, items, '2026-11-18')).toEqual([])
    expect(itemsOfWeek({ week: '2026-11-16', status: 'kombo', adopted_at: null }, items, '2026-11-18')).toEqual([])
    expect(itemsOfWeek(null, items, '2026-11-18')).toEqual([])
  })
})

describe('Casa aufräumen: Tage seit Beginn und „zuletzt geöffnet“', () => {
  it('zählt nie negativ', () => {
    expect(TRACK_START).toBe('2026-11-19')
    expect(trackingDays('2026-11-19')).toBe(0)
    expect(trackingDays('2026-11-20')).toBe(1)
    expect(trackingDays('2026-11-25')).toBe(6)
    expect(trackingDays('2026-11-01')).toBe(0)
  })
  it('sauberer Text für heute, gestern und später', () => {
    expect(trackingText('2026-11-19')).toBe('Casa schreibt seit heute mit – in 30 Tagen weiß ich mehr.')
    expect(trackingText('2026-11-20')).toBe('Casa schreibt seit gestern mit – in 29 Tagen weiß ich mehr.')
    expect(trackingText('2026-11-25')).not.toMatch(/-/)
  })
  it('rechnet in Berliner Kalendertagen (kurz nach Mitternacht ist schon heute)', () => {
    // 23:30 UTC am 19.11. = 00:30 Uhr am 20.11. in Berlin
    expect(berlinDay('2026-11-19T23:30:00Z')).toBe('2026-11-20')
    expect(lastOpenedText('2026-11-19T23:30:00Z', '2026-11-20')).toBe('heute')
    expect(lastOpenedText('2026-11-19T10:00:00Z', '2026-11-20')).toBe('gestern')
    expect(lastOpenedText('2026-11-15T10:00:00Z', '2026-11-20')).toBe('vor 5 Tagen')
    expect(lastOpenedText(null, '2026-11-20')).toBe('noch nie geöffnet')
  })
})
