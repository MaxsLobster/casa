// Wirkung von Ereignissen auf die Normalwoche eines Tages.
// Die Normalwoche selbst bleibt unverändert; hier wird nur der Tageszustand (DayState)
// für die Anzeige umgebaut: Einträge entfallen oder werden zu offenen Slots.

import type { Area, Member, Event, Person } from './types'
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
  /** Messetag (Munich Watch Fair): beide weg */
  messe: Occurrence | null
  /** erster / letzter Tag von „Valerie ist weg" (Übergabe) */
  isFirst: boolean
  isLast: boolean
}

export const NO_EFFECTS: DayEffects = { valerieWeg: null, kitaZu: null, away: [], messe: null, isFirst: false, isLast: false }

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
    } else if (o.effect === 'messe') {
      fx.messe = o
      for (const m of members.filter((x) => x.role === 'partner')) {
        if (!fx.away.some((a) => a.member.id === m.id)) fx.away.push({ member: m, occ: o })
      }
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
  // „Kita zu" ist Hintergrundwissen und bekommt keine eigene Zeile (nur die kleine Bearbeiten-Zeile in der Woche)
  if (fx.messe) out.push({ label: 'Messe', text: `Munich Watch Fair (${spanLabel(fx.messe.occ_date, fx.messe.occ_end)}) · ihr seid beide weg`, occ: fx.messe })
  for (const a of fx.away) {
    if (a.occ.effect === 'messe') continue
    const span = spanLabel(a.occ.occ_date, a.occ.occ_end)
    const custom = a.occ.title.trim().toLowerCase() !== `${a.member.display_name.toLowerCase()} weg`
    out.push({ label: v.me?.id === a.member.id ? 'Du' : a.member.display_name, text: `Weg (${span})` + (custom ? ` · ${a.occ.title}` : ''), occ: a.occ })
  }
  void date
  return out
}

/** Ist das Mitglied an diesem Tag laut Ereignis „… ist weg"? Der Messetag zählt nur für Casa, nicht für MWF-Aufgaben. */
export function awayOn(events: Event[], memberId: string, date: ISODate, area: Area = 'casa'): boolean {
  return occurrences(events.filter((e) => (e.effect === 'eltern_weg' && e.member_id === memberId) || (e.effect === 'messe' && area === 'casa')), date, date).some((o) => o.occ_date <= date && o.occ_end >= date)
}

/** Offene Chips eines Tages (Woche-Details und Heute an anderen Tagen) */
export function openChips(state: DayState, fx: DayEffects): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = []
  const ho = handoverOpen(fx)
  if (ho.dropoff) chips.push({ key: 'dropoff', label: 'Wer bringt sie hin? · übernehmen' })
  if (ho.pickup) chips.push({ key: 'pickup', label: 'Wer holt sie ab? · übernehmen' })
  if (state.valerie_tag?.is_open) chips.push({ key: 'tag', label: 'Valerie tagsüber · wer?' })
  const vb = state.valerie_bringen
  const vh = state.valerie_holen
  if (vb?.is_open && vh?.is_open) chips.push({ key: 'valerie', label: 'Bringen und Holen offen · übernehmen' })
  else if (vb?.is_open) chips.push({ key: 'bringen', label: 'Bringen offen · übernehmen' })
  else if (vh?.is_open) chips.push({ key: 'holen', label: 'Holen offen · übernehmen' })
  const es = state.abend_essen
  const bt = state.abend_bett
  if (es?.is_open && bt?.is_open) chips.push({ key: 'abend', label: 'Abend offen · übernehmen' })
  else if (es?.is_open) chips.push({ key: 'essen', label: 'Essen offen · übernehmen' })
  else if (bt?.is_open) chips.push({ key: 'bett', label: 'Bettgehen offen · übernehmen' })
  if (state.wochenende?.is_open) chips.push({ key: 'familientag', label: 'Familientag? · festlegen' })
  return chips
}
