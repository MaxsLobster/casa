// Mila · Einkaufslogik: Abteilung per Stichwort, freie Eingabe, Mengen
import rules from './shop-rules.json'
import type { ShopCategory } from '../lib/types'

export const SHOP_ORDER = rules.order as ShopCategory[]
export const SHOP_LABELS = rules.labels as Record<ShopCategory, string>

/** Abteilung nach Stichwort-Regeln (aus der alten Mila übernommen) */
export function categorize(name: string): ShopCategory {
  const n = (name || '').toLowerCase()
  for (const { cat, keywords } of rules.rules) for (const kw of keywords) if (n.includes(kw)) return cat as ShopCategory
  return 'sonstiges'
}

/** „Zitronen 3 Stück“ → Name „Zitronen“, Menge „3 Stück“ */
export function parseManualInput(text: string): { name: string; amount: string } {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return { name: '', amount: '' }
  const m = t.match(/^(.+?)\s+(\d+(?:[.,]\d+)?\s*[a-zA-ZäöüÄÖÜß]*)$/)
  if (m) return { name: m[1].trim(), amount: m[2].trim() }
  const m2 = t.match(/^(\d+(?:[.,]\d+)?\s*[a-zA-ZäöüÄÖÜß]*)\s+(.+)$/)
  if (m2 && /^\d/.test(m2[1]) && !/^\d+\.$/.test(m2[1])) return { name: m2[2].trim(), amount: m2[1].trim() }
  return { name: t, amount: '' }
}

/** Zahl hübsch: 0,5 → ½, 1,5 → 1½, 2.5 → 2,5, 300 → 300 */
export function formatNumber(n: number): string {
  const whole = Math.floor(n)
  const frac = n - whole
  if (Math.abs(frac - 0.5) < 0.01) return (whole ? String(whole) : '') + '½'
  if (Math.abs(frac - 0.25) < 0.01) return (whole ? String(whole) : '') + '¼'
  if (Math.abs(frac - 0.75) < 0.01) return (whole ? String(whole) : '') + '¾'
  if (Math.abs(frac) < 0.01) return String(whole)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Menge + Einheit als Text, z. B. „500 g“, „½ Bund“, „nach Geschmack“ */
export function formatAmount(amount: number | null, unit: string): string {
  const u = (unit ?? '').trim()
  if (amount === null || amount === undefined) return u
  const n = formatNumber(Number(amount))
  return u ? `${n} ${u}` : n
}
