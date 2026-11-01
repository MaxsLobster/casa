// Wirkung von Ereignissen auf die Normalwoche eines Tages.
// Die Normalwoche selbst bleibt unverändert; hier wird nur der Tageszustand (DayState)
// für die Anzeige umgebaut: Einträge entfallen oder werden zu offenen Slots.

import type { Member, Event, Person } from './types'
import type { DayState, SlotState, Voice } from './week'
import { SLOT_ORDER, verb } from './week'
import { occurrences, type Occurrence } from './recur'
import { spanLabel, uhr, type ISODate } from './dates'

export interface AwayMember {
  member: Member
  occ: Occurrence
}

export interface DayEffects {
  /** „Valerie ist weg" an diesem Tag (gewinnt gegen „Kita zu") */
  valerieWeg: Occurrence | null
  /** „Kita zu" an diesem Tag */
  kitaZu: Occurrence | null
  /** Max und/oder Anna sind an diesem Tag weg */
  away: AwayMember[]
  /** erster / letzter Tag von „Valerie ist weg" (Übergabe) */
  isFirst: boolean
  isLast: boolean
}

export const NO_EFFECTS: DayEffects = { valerieWeg: null, kitaZu: null, away: [], isFirst: false, isLast: false }

export function isEffectEvent(e: { effect?: Event['effect'] }): boolean {
  return !!e.effect && e.effect !== 'termin'
}

/** Welche Ereignisse wirken an diesem Tag? `occ` sind die Vorkommen, die den Tag berühren. */
export function dayEffects(date: ISODate, occ: Occurrence[], members: Member[]): DayEffects {
  const fx: DayEffects = { ...NO_EFFECTS, away: [] }
  for (const o of occ) {
    if (o.occ_date > date || o.occ_end < date) continue
    if (o.effect === 'valerie_weg') {
      // Bei Überschneidung: das länger laufende behalten
      if (!fx.valerieWeg || o.occ_end > fx.valerieWeg.occ_end) fx.valerieWeg = o
    } else if (o.effect === 'kita_zu') {
      if (!fx.kitaZu || o.occ_end > fx.kitaZu.occ_end) fx.kitaZu = o
    } else if (o.effect === 'eltern_weg' && o.member_id) {
      const m = members.find((x) => x.id === o.member_id)
      if (m && !fx.away.some((a) => a.member.id === m.id)) fx.away.push({ member: m, occ: o })
    }
  }
  if (fx.valerieWeg) {
    fx.isFirst = fx.valerieWeg.occ_date === date
    fx.isLast = fx.valerieWeg.occ_end === date
  }
  return fx
}

function sameName(value: string | null | undefined, name: string): boolean {
  return !!value && value.trim().toLowerCase() === name.trim().toLowerCase()
}

/**
 * Tageszustand nach Wirkung der Ereignisse:
 *  · Valerie ist weg: Bringen, Holen weg; Bettgehen weg (außer am letzten Tag, da gilt abends wieder die Normalwoche)
 *  · Kita zu: Bringen, Holen weg; ein offener Slot „valerie_tag" (wer hat sie tagsüber?), außer Valerie ist weg
 *  · Max/Anna weg: alles, was in der Normalwoche bei der Person liegt, wird offen (eingetragene Abweichungen bleiben)
 */
export function applyEffects(state: DayState, fx: DayEffects): DayState {
  const out: DayState = { ...state }
  if (fx.valerieWeg) {
    delete out.valerie_bringen
    delete out.valerie_holen
    delete out.valerie_tag
    if (!fx.isLast) delete out.abend_bett
  } else if (fx.kitaZu) {
    delete out.valerie_bringen
    delete out.valerie_holen
    if (!out.valerie_tag) {
      out.valerie_tag = { slot: 'valerie_tag', value: null, at: null, is_open: true, note: null, overridden: false }
    }
  } else {
    // „valerie_tag" gibt es nur, wenn die Kita zu ist
    delete out.valerie_tag
  }
  for (const a of fx.away) {
    const name = a.member.display_name
    if (sameName('anna', name) && out.anna_arbeit && !out.anna_arbeit.overridden) delete out.anna_arbeit
    for (const s of SLOT_ORDER) {
      const cur = out[s]
      if (!cur || cur.overridden || !sameName(cur.value, name)) continue
      const open: SlotState = { ...cur, value: null, is_open: true, note: `${name} ist weg` }
      out[s] = open
    }
  }
  return out
}

/** Übergabe-Chips bei „Valerie ist weg": am ersten Tag „wer bringt sie hin?", am letzten „wer holt sie ab?" */
export function handoverOpen(fx: DayEffects): { dropoff: boolean; pickup: boolean } {
  const v = fx.valerieWeg
  return {
    dropoff: !!v && fx.isFirst && !v.dropoff_by,
    pickup: !!v && fx.isLast && !v.pickup_by,
  }
}

export function personName(e: { person_id: string | null }, people: Person[]): string | null {
  if (!e.person_id) return null
  return people.find((p) => p.id === e.person_id)?.name ?? null
}

/** „Valerie bei Oma" · „Kita zu" · „Max weg" – Standardtitel, wenn beim Eintragen nichts steht */
export function defaultTitle(effect: Event['effect'], personName: string | null, memberName: string | null): string {
  if (effect === 'valerie_weg') return personName ? `Valerie bei ${personName}` : 'Valerie ist weg'
  if (effect === 'kita_zu') return 'Kita zu'
  if (effect === 'eltern_weg') return memberName ? `${memberName} weg` : 'Weg'
  return ''
}

export interface EffectLine {
  label: string
  text: string
  occ: Occurrence
}

/** Zeile in Woche/Heute für ein Wirkungs-Ereignis, z. B. „Valerie: Bei Oma (So–Di), du bringst sie hin um 10 Uhr" */
export function effectLines(date: ISODate, fx: DayEffects, v: Voice, people: Person[]): EffectLine[] {
  const out: EffectLine[] = []
  const vw = fx.valerieWeg
  if (vw) {
    const span = spanLabel(vw.occ_date, vw.occ_end)
    const pn = personName(vw, people)
    let text = pn ? `Bei ${pn} (${span})` : `${vw.title} (${span})`
    if (fx.isFirst && vw.dropoff_by) text += `, ${verb(vw.dropoff_by, v, 'bringst', 'bringt')} sie hin${vw.dropoff_at ? ` um ${uhr(vw.dropoff_at)}` : ''}`
    if (fx.isLast && vw.pickup_by) text += `, ${verb(vw.pickup_by, v, 'holst', 'holt')} sie ab${vw.pickup_at ? ` um ${uhr(vw.pickup_at)}` : ''}`
    out.push({ label: 'Valerie', text, occ: vw })
  }
  const kz = fx.kitaZu
  // Ist Valerie weg, gilt das ohnehin; die Kita-Zeile wäre nur Doppelung
  if (kz && !vw) {
    const span = spanLabel(kz.occ_date, kz.occ_end)
    const custom = kz.title.trim().toLowerCase() !== 'kita zu'
    out.push({ label: 'Kita', text: `Zu (${span})` + (custom ? ` · ${kz.title}` : ''), occ: kz })
  }
  for (const a of fx.away) {
    const span = spanLabel(a.occ.occ_date, a.occ.occ_end)
    const custom = a.occ.title.trim().toLowerCase() !== `${a.member.display_name.toLowerCase()} weg`
    out.push({ label: v.me?.id === a.member.id ? 'Du' : a.member.display_name, text: `Weg (${span})` + (custom ? ` · ${a.occ.title}` : ''), occ: a.occ })
  }
  void date
  return out
}

/** Ist das Mitglied an diesem Tag laut Ereignis „… ist weg"? */
export function awayOn(events: Event[], memberId: string, date: ISODate): boolean {
  return occurrences(events.filter((e) => e.effect === 'eltern_weg' && e.member_id === memberId), date, date).some((o) => o.occ_date <= date && o.occ_end >= date)
}
