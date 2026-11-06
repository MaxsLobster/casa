// Mila · Einkaufszettel, live geteilt. Aus der übernommenen Woche automatisch, nach Ladengang sortiert.
// „meist Vorrat“ steht grau vorab abgehakt; Antippen setzt es doch auf den Zettel.
import { useMemo, useState, type FormEvent } from 'react'
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'
import { SHOP_LABELS, SHOP_ORDER, parseManualInput } from './shopping'
import { adoptedMenu } from './menu-view'
import { weekKey } from './week-list'
import { Collapse } from '../components/ui'
import { weekdayLongByIndex } from '../lib/dates'
import type { MilaShoppingItem } from '../lib/types'

export function Liste() {
  const { items, me, partner, members, menus, rhythm, addItems, setChecked, setStock, finishShopping } = useMila()
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(true)

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null
  const open = useMemo(() => items.filter((i) => !i.checked).sort(byCreated), [items])
  const toBuy = open.filter((i) => !i.is_stock)
  const done = useMemo(() => items.filter((i) => i.checked).sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? '')), [items])
  const groups = SHOP_ORDER.map((cat) => ({ cat, label: SHOP_LABELS[cat], items: open.filter((i) => i.category === cat).sort((a, b) => Number(a.is_stock) - Number(b.is_stock)) })).filter((g) => g.items.length)

  // Kopf: „6 Mahlzeiten · 3 Personen“ aus der übernommenen Woche, wenn ihre Zeilen auf dem Zettel stehen
  const menu = adoptedMenu(menus)
  const fromMenu = menu?.plan && items.some((i) => i.source_week === weekKey(menu.week))
  const people = menu?.plan ? Math.max(0, ...menu.plan.slots.filter((s) => s.meal === 'abend').map((s) => s.servings)) : 0
  const meta = fromMenu && menu?.plan ? `${menu.plan.slots.length} Mahlzeiten · ${people} ${people === 1 ? 'Person' : 'Personen'} · ` : ''

  function submit(e: FormEvent) {
    e.preventDefault()
    const { name, amount } = parseManualInput(text)
    if (!name) return
    setText('')
    addItems([{ name, amount }])
  }

  return (
    <MilaPage>
      <header className="m-shop__head">
        <div className="stack stack--tight">
          <span className="m-sub">Großer Einkauf · {weekdayLongByIndex(rhythm.shop_weekday).slice(0, 2)}</span>
          <span className="m-title" style={{ fontSize: 40, lineHeight: 0.95 }}>Einkaufszettel</span>
          <span className="m-hint" style={{ fontSize: 12 }}>{meta}{toBuy.length} offen</span>
        </div>
        <span className="m-shop__live">
          <span className="m-initials">
            <span className="m-initial m-initial--navy">{(me.display_name[0] ?? 'M').toUpperCase()}</span>
            {partner && <span className="m-initial m-initial--gold">{(partner.display_name[0] ?? 'A').toUpperCase()}</span>}
          </span>
          live geteilt
        </span>
      </header>

      <form className="m-add" onSubmit={submit}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        <input type="text" className="m-add__input" placeholder="Was fehlt noch?" aria-label="Was fehlt noch?" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" autoComplete="off" />
      </form>

      {open.length === 0 && done.length === 0 && <p className="m-hint">Noch nichts auf dem Zettel. Er füllt sich, sobald ihr eine Woche übernehmt. Eigenes oben eintippen.</p>}

      {groups.map((g) => (
        <section key={g.cat} className="m-group">
          <h2 className="m-group__label">{g.label}</h2>
          {g.items.map((it) =>
            it.is_stock ? (
              <button key={it.id} type="button" className="m-item m-item--stock" onClick={() => setStock(it.id, false)} aria-label={`${it.name}: doch kaufen`}>
                <span className="m-check m-check--stock">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="m-item__name m-item__name--stock">{it.name}</span>
                <span className="m-item__right">
                  {it.amount && <span className="m-item__amount">{it.amount}</span>}
                  <span className="m-item__src">Vorrat</span>
                </span>
              </button>
            ) : (
              <Row key={it.id} item={it} who={it.source_label ? null : nameOf(it.added_by)} mine={it.added_by === me.id} onToggle={() => setChecked(it.id, true)} />
            ),
          )}
        </section>
      ))}

      {open.some((i) => i.is_stock) && <p className="m-hint" style={{ fontSize: 12 }}>Grau = „haben wir schon“ (Vorrat). Antippen setzt es doch auf den Zettel.</p>}

      {done.length > 0 && (
        <section className="m-group" style={{ marginTop: 4 }}>
          <button type="button" className="m-cart" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            Im Wagen · {done.length}
            <span className={'m-cart__arrow' + (showDone ? ' m-cart__arrow--open' : '')} aria-hidden>▸</span>
          </button>
          <Collapse open={showDone}>
            <div>
              {done.map((it) => (
                <button key={it.id} type="button" className="m-item m-item--done" onClick={() => setChecked(it.id, false)}>
                  <span className="m-check m-check--done">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <span className="m-item__name m-item__name--done">{it.name}</span>
                </button>
              ))}
              <button type="button" className="btn btn--ghost m-finish" onClick={finishShopping}>Einkauf abschließen</button>
            </div>
          </Collapse>
        </section>
      )}
    </MilaPage>
  )
}

function byCreated(a: MilaShoppingItem, b: MilaShoppingItem) {
  return a.created_at.localeCompare(b.created_at)
}

function Row({ item, who, mine, onToggle }: { item: MilaShoppingItem; who: string | null; mine: boolean; onToggle: () => void }) {
  const src = item.source_label ?? who
  return (
    <button type="button" className="m-item" onClick={onToggle} aria-label={`${item.name} abhaken`}>
      <span className="m-check" />
      <span className="m-item__name">{item.name}</span>
      <span className="m-item__right">
        {item.amount && <span className="m-item__amount">{item.amount}</span>}
        {src && <span className={'m-item__src' + (who && !mine ? ' m-item__src--partner' : '')}>{src}</span>}
      </span>
    </button>
  )
}
