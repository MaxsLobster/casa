// Wer hat Valerie? Einträge erkennen, die nach Bringen, Holen oder Aufpassen klingen
// („Theresa holt Valerie“, „Oma passt auf“, „Opa bringt sie“), und Doppeltes finden.
// Die Tageskarte auf Heute ist die eine Stelle, an der man sieht, wer Valerie hat.
// Wird auch vom Manager genutzt (src/manager/shared-entry.ts) – daher ohne React und ohne App-Typen-Zwang.

export type VSlot = 'valerie_bringen' | 'valerie_holen'

export interface VGuess {
  slot: VSlot
  /** Wer laut Text (erstes Wort wie „Theresa“, „Oma“ oder „von Oma“), sonst null */
  who: string | null
  /** passt auf sie auf */
  watch: boolean
  /** passt auf bis …, als HH:MM */
  until: string | null
}

const REF = /\b(valerie|vali|sie|die kleine|kind|kita|kindergarten)\b/
const HOLEN = /\b(holt|hole|holst|holen|abholen|abgeholt|abholung)\b/
const BRINGEN = /\b(bringt|bringe|bringst|bringen|hinbringen|gebracht)\b/
const WATCH = /\b(passt|passen|passe)\b(?:\s+\S+){0,4}?\s+auf\b|\baufpassen\b|\bbabysit/
const NOT = /ins bett|bettgehen|müll|tonne|paket|post\b/
const NOT_WHO = new Set(['valerie', 'vali', 'kita', 'kindergarten', 'heute', 'morgen', 'bitte', 'die', 'der', 'das', 'wer', 'sie', 'mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'])

const pad = (n: number) => String(n).padStart(2, '0')

/** „bis 18 Uhr“, „bis 18:30“ → „18:00“, „18:30“ */
export function untilFrom(text: string): string | null {
  const m = /\bbis\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr|h)?\b/i.exec(text)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

/** Klingt der Titel nach Bringen, Holen oder Aufpassen bei Valerie? */
export function guessValerie(title: string): VGuess | null {
  const raw = title.trim()
  const t = raw.toLowerCase()
  if (!t || NOT.test(t)) return null
  const watch = WATCH.test(t)
  const holen = HOLEN.test(t) && REF.test(t)
  const bringen = BRINGEN.test(t) && REF.test(t)
  if (!holen && !bringen && !watch) return null
  const slot: VSlot = holen || (watch && !bringen) ? 'valerie_holen' : 'valerie_bringen'
  let who: string | null = null
  const first = /^([A-ZÄÖÜ][a-zäöüß]+)\b/.exec(raw)
  if (first && !NOT_WHO.has(first[1].toLowerCase())) who = first[1]
  if (!who) {
    const von = /\b(?:von|bei)\s+([A-ZÄÖÜ][a-zäöüß]+)\b/.exec(raw)
    if (von && !NOT_WHO.has(von[1].toLowerCase())) who = von[1]
  }
  return { slot, who, watch, until: watch ? untilFrom(raw) : null }
}

/** Zusatz an der Ausnahme: „passt auf bis 18 Uhr“ oder „passt auf“ */
export function watchNote(until: string | null): string {
  if (!until) return 'passt auf'
  const [h, m] = until.split(':').map(Number)
  return `passt auf bis ${m ? `${h}:${pad(m)}` : h} Uhr`
}

/** Aus dem Hinweis einer Ausnahme: passt auf? bis wann (HH:MM)? */
export function watchFrom(note: string | null | undefined): { watch: boolean; until: string | null } {
  if (!note || !/passt auf|aufpassen/i.test(note)) return { watch: false, until: null }
  return { watch: true, until: untilFrom(note) }
}

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

// ---------------------------------------------------------------------------
// Doppeltes: Normalwoche/Ausnahme und ein Eintrag, der nach Valerie klingt
// ---------------------------------------------------------------------------

export interface VEntry {
  kind: 'event' | 'task'
  id: string
  title: string
  slot: VSlot
  who: string
  at: string | null
  /** Zusatz „passt auf …“ für die Ausnahme, falls dieser Eintrag gewinnt */
  note: string | null
}

interface EntryEvent {
  id: string
  base_id?: string
  title: string
  start_time: string | null
  person_id: string | null
  member_id: string | null
  effect?: string | null
  is_repeat?: boolean
  repeat?: string | null
  occ_date?: string
  occ_end?: string
  valerie_cleared?: boolean
}
interface EntryTask {
  id: string
  title: string
  due_date: string
  status: string
  owner_member_id: string | null
  archived_at?: string | null
  valerie_cleared?: boolean
}

/** Einträge eines Tages, die nach Bringen/Holen/Aufpassen klingen (einmalige Termine und offene Aufgaben) */
export function valerieEntries(
  date: string,
  occ: EntryEvent[],
  tasks: EntryTask[],
  people: { id: string; name: string }[],
): VEntry[] {
  const out: VEntry[] = []
  for (const o of occ) {
    if (o.effect && o.effect !== 'termin') continue
    if (o.is_repeat || o.repeat || o.valerie_cleared) continue
    if (o.occ_date && o.occ_end && (o.occ_date !== date || o.occ_end !== date)) continue
    const g = guessValerie(o.title)
    if (!g) continue
    const who = g.who ?? people.find((p) => p.id === o.person_id)?.name ?? null
    if (!who) continue
    out.push({ kind: 'event', id: o.base_id ?? o.id, title: o.title, slot: g.slot, who, at: o.start_time ? o.start_time.slice(0, 5) : null, note: g.watch ? watchNote(g.until) : null })
  }
  for (const t of tasks) {
    if (t.status === 'erledigt' || t.archived_at || t.valerie_cleared || t.due_date !== date) continue
    const g = guessValerie(t.title)
    if (!g || !g.who) continue
    out.push({ kind: 'task', id: t.id, title: t.title, slot: g.slot, who: g.who, at: null, note: g.watch ? watchNote(g.until) : null })
  }
  return out
}

export interface VConflict {
  slot: VSlot
  /** „Wer holt?“ / „Wer bringt?“ */
  question: string
  /** Kandidaten in Reihenfolge: zuerst, wer jetzt eingetragen ist */
  names: string[]
  current: string | null
  entries: VEntry[]
}

interface SlotLike {
  value: string | null
  at: string | null
  is_open: boolean
}

/**
 * Kommen für denselben Tag zwei Personen fürs Bringen oder Holen in Frage?
 * Nur, wenn es den Slot an dem Tag gibt (nicht bei Kita zu, Valerie weg, Wochenende).
 * Einträge mit derselben Person wie der Slot sind kein Konflikt (die Tageskarte sagt es schon).
 */
export function valerieConflicts(state: Partial<Record<string, SlotLike>>, entries: VEntry[]): VConflict[] {
  const out: VConflict[] = []
  for (const slot of ['valerie_bringen', 'valerie_holen'] as VSlot[]) {
    const s = state[slot]
    if (!s) continue
    const mine = entries.filter((e) => e.slot === slot)
    if (!mine.length) continue
    const current = s.is_open ? null : s.value
    const names: string[] = current ? [current] : []
    for (const e of mine) if (!names.some((n) => same(n, e.who))) names.push(e.who)
    if (names.length < 2) continue
    out.push({ slot, question: slot === 'valerie_holen' ? 'Wer holt?' : 'Wer bringt?', names, current, entries: mine.filter((e) => !same(e.who, current)) })
  }
  return out
}

/** Einträge, die die Tageskarte schon zeigt (gleiche Person wie im Slot) oder die in einem Konflikt stecken */
export function coveredEntryIds(state: Partial<Record<string, SlotLike>>, entries: VEntry[]): Set<string> {
  const ids = new Set<string>()
  for (const e of entries) if (state[e.slot]) ids.add(e.id)
  return ids
}

/** Für die Nachfrage beim Eintragen: Was würde der neue Eintrag ersetzen? null = nichts zu fragen */
export function replaceQuestion(state: Partial<Record<string, SlotLike>>, g: VGuess, who: string | null): { slot: VSlot; current: SlotLike } | null {
  if (!who) return null
  const s = state[g.slot]
  if (!s) return null
  if (!s.is_open && same(s.value, who)) return null
  return { slot: g.slot, current: s }
}
