export function Sonntag() {
  return (
    <div className="page" style={{ gap: 16 }}>
      <header className="stack stack--tight">
        <span className="kicker">Sonntag · 20:00</span>
        <h1 className="h1">Sonntagsrunde</h1>
      </header>
      <p className="hand hand--navy">Kommt bald.</p>
      <p className="hint">
        Hier füllt sich einmal die Woche von selbst eine kurze Runde: was wir geschafft haben, was noch zu klären ist, Ideen vom Parkplatz und was wir beschließen.
      </p>
      <div className="stack" style={{ gap: 6, marginTop: 8 }}>
        {['Geschafft', 'Noch zu klären', 'Vom Parkplatz', 'Beschlossen'].map((t, i) => (
          <div className="row" key={t} style={{ opacity: 0.55 }}>
            <span className="row__mark" style={{ color: 'var(--gold)' }}>{i + 1}</span>
            <span className="label" style={{ fontWeight: 600, color: 'var(--ink)' }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
