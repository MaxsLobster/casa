// Mila · Einkaufsliste (Schritt 3: Gerüst; die Liste selbst kommt in Schritt 4)
import { MilaPage } from './Mila'
import { useMila } from './MilaContext'

export function Liste() {
  const { items } = useMila()
  const open = items.filter((i) => !i.checked).length
  return (
    <MilaPage>
      <header className="stack stack--tight">
        <span className="m-title">Einkauf</span>
        <span className="m-sub">{open} offen</span>
      </header>
      <p className="m-hint">Die geteilte Liste kommt im nächsten Schritt.</p>
    </MilaPage>
  )
}
