// Sonstiges (hinter dem Zahnrad): Hausbuch, Geschenk-Dose, Für zwischendurch, Casa aufräumen, Einstellungen.
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, Toggle } from '../components/ui'
import { useCasa, useToday } from '../state/HouseholdContext'
import type { GiftPerson, HouseEntry } from '../lib/types'
import { AREAS, SECTIONS, birthdayLabel, lastOpenedText, nextBirthday, trackingDays, trackingText, unusedAreas, useSonstiges } from './useSonstiges'
import { managerBus } from '../screens/managerBus'
import { MoonIcon } from '../components/MoonIcon'
import { dailyText, moonPhase, type DailyKind } from '../lib/daily'
import './sonstiges.css'

const back = { state: { sonstiges: true } }

// ---------------------------------------------------------------------------
// Blatt „Sonstiges“
// ---------------------------------------------------------------------------
export function SonstigesSheet({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const { settings } = useCasa()
  const today = useToday()
  const so = useSonstiges()
  const hidden = settings?.hidden_areas ?? []
  const next = so.people.map((p) => ({ p, d: nextBirthday(p, today) })).filter((x) => x.d).sort((a, b) => a.d!.localeCompare(b.d!))[0]
  const unused = unusedAreas(so.visits, hidden, today).filter((a) => a.unused).length
  const rows = [
    { key: 'hausbuch', icon: '🏠', title: 'Hausbuch', sub: 'WLAN, Handwerker, Zähler, rund ums Haus', to: '/hausbuch' },
    { key: 'geschenke', icon: '🎁', title: 'Geschenk-Dose', sub: next ? `Ideen sammeln · ${next.p.name} ${birthdayLabel(next.p, today)}` : 'Ideen sammeln für Geburtstage', to: '/geschenke' },
    { key: 'zwischendurch', icon: '☾', title: 'Für zwischendurch', sub: `${moonPhase(today).label} · Weisheit, Wort und Heute vor Jahren`, to: '/zwischendurch' },
    { key: 'aufraeumen', icon: '🧹', title: 'Casa aufräumen', sub: unused ? `${unused} ${unused === 1 ? 'Bereich' : 'Bereiche'} seit 30 Tagen ungenutzt` : 'Ungenutztes ausblenden, Wochenputz', to: '/aufraeumen' },
    { key: 'einstellungen', icon: '⚙︎', title: 'Einstellungen', sub: 'Mitteilungen, Ruhezeiten, Bereiche', to: '/einstellungen' },
  ].filter((r) => !hidden.includes(r.key))
  return (
    <Sheet onClose={onClose} title="Sonstiges">
      <span className="so__sheettitle">Sonstiges</span>
      <div className="so__rows">
        {rows.map((r) => (
          <button key={r.key} type="button" className="so__row" onClick={() => { onClose(); nav(r.to) }}>
            <span className="so__icon" aria-hidden>{r.icon}</span>
            <span className="so__rowtext">
              <span className="so__rowtitle">{r.title}</span>
              <span className="so__rowsub">{r.sub}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Top({ title }: { title: string }) {
  const nav = useNavigate()
  return (
    <>
      <button type="button" className="so__back" onClick={() => nav('/heute', back)}>‹ Sonstiges</button>
      <h1 className="h1 so__h1">{title}</h1>
    </>
  )
}

// ---------------------------------------------------------------------------
// Für zwischendurch: Mondphase, Weisheit, Wort und Heute vor Jahren (früher oben auf Heute)
// ---------------------------------------------------------------------------
export function Zwischendurch() {
  const today = useToday()
  const moon = moonPhase(today)
  const texts = (['weisheit', 'wort', 'heute'] as DailyKind[]).map((k) => dailyText(k, today)).filter((t): t is NonNullable<typeof t> => !!t)
  return (
    <div className="page so">
      <Top title="Für zwischendurch" />
      <div className="so__moon">
        <MoonIcon fraction={moon.fraction} waxing={moon.waxing} label={moon.label} />
        <span className="so__rowtitle">Mond {moon.label}</span>
        <span className="so__rowsub">{Math.round(moon.fraction * 100)} % beleuchtet</span>
      </div>
      <div className="so__tear" />
      {texts.map((t) => (
        <figure key={t.label} className="so__daily">
          <span className="so__label">{t.label}</span>
          <blockquote className="hand" style={{ margin: 0, fontSize: 25, lineHeight: 1.2 }}>{t.text}</blockquote>
          {t.source && <figcaption className="so__rowsub" style={{ alignSelf: 'flex-end' }}>{t.source}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hausbuch
// ---------------------------------------------------------------------------
/** Keine Konto- oder Kartennummern (IBAN-Form, 15/16-stellige Kartennummer mit gültiger Prüfziffer) */
function forbidden(v: string): boolean {
  const t = v.replace(/[\s-]/g, '')
  if (/[A-Z]{2}\d{2}\d{8,}[A-Z0-9]*/i.test(t) && t.length >= 15) return true
  const m = t.match(/\d{15,16}/)
  if (!m) return false
  let sum = 0
  m[0].split('').reverse().forEach((c, i) => {
    let n = Number(c)
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2
    sum += n
  })
  return sum % 10 === 0
}

export function Hausbuch() {
  const so = useSonstiges()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<HouseEntry> | null>(null)
  const [shown, setShown] = useState<Set<string>>(new Set())
  const sections = useMemo(() => [...SECTIONS, ...[...new Set(so.entries.map((e) => e.section))].filter((s) => !SECTIONS.includes(s))], [so.entries])

  const ask = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) managerBus.open(`Frag das Hausbuch: ${q.trim()}`)
    setQ('')
  }

  return (
    <div className="page so">
      <Top title="Hausbuch" />
      <form className="so__ask" onSubmit={ask}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
        <input className="so__askfield" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Frag das Hausbuch …" enterKeyHint="search" aria-label="Frag das Hausbuch" />
      </form>
      <div className="so__tear" />
      {sections.map((s) => {
        const list = so.entries.filter((e) => e.section === s)
        return (
          <section key={s} className="so__sec">
            <div className="so__sechead">
              <span className="so__label">{s}</span>
              <button type="button" className="so__plus" onClick={() => setEdit({ section: s, hidden: s === 'Für Gäste' })} aria-label={`Eintrag in ${s}`}>+</button>
            </div>
            {list.length === 0 && <span className="so__empty">noch leer</span>}
            {list.map((e) => {
              const veiled = e.hidden && !shown.has(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  className="so__entry"
                  onClick={() => (veiled ? setShown(new Set([...shown, e.id])) : setEdit(e))}
                >
                  <span className="so__entrytop">
                    <span className="so__entrytitle">{e.title}</span>
                    <span className={'so__entryval' + (veiled ? ' so__entryval--veil' : '')}>{veiled ? 'antippen zum Zeigen' : e.value ?? ''}</span>
                  </span>
                  {(e.date || e.note) && !veiled && <span className="so__entrynote">{[e.date ? deDate(e.date) : null, e.note].filter(Boolean).join(' · ')}</span>}
                </button>
              )
            })}
          </section>
        )
      })}
      <button type="button" className="so__add" onClick={() => setEdit({ section: '', hidden: false })}>+ Neuer Eintrag oder Bereich</button>
      {edit && <EntryEditor entry={edit} sections={sections} onClose={() => setEdit(null)} save={so.saveEntry} remove={so.removeEntry} />}
    </div>
  )
}

function EntryEditor({ entry, sections, onClose, save, remove }: { entry: Partial<HouseEntry>; sections: string[]; onClose: () => void; save: ReturnType<typeof useSonstiges>['saveEntry']; remove: (id: string) => Promise<void> }) {
  const [section, setSection] = useState(entry.section ?? '')
  const [title, setTitle] = useState(entry.title ?? '')
  const [value, setValue] = useState(entry.value ?? '')
  const [date, setDate] = useState(entry.date ?? '')
  const [note, setNote] = useState(entry.note ?? '')
  const [hidden, setHidden] = useState(!!entry.hidden)
  const [sure, setSure] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const go = async () => {
    if (!title.trim() || !section.trim()) return setErr('Bereich und Titel fehlen noch.')
    if (forbidden(value) || forbidden(note)) return setErr('Das sieht nach einer Konto-, Ausweis- oder Kartennummer aus. Die gehören nicht ins Hausbuch.')
    try {
      await save({ id: entry.id, section, title, value, date: date || null, note, hidden })
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <Sheet onClose={onClose} title="Hausbuch-Eintrag">
      <span className="so__sheettitle">{entry.id ? 'Eintrag ändern' : 'Neuer Eintrag'}</span>
      <div className="stack" style={{ gap: 6 }}>
        <span className="so__label">Bereich</span>
        <div className="so__chips">
          {sections.map((s) => (
            <button key={s} type="button" className={'so__chip' + (section === s ? ' so__chip--on' : '')} onClick={() => setSection(s)}>{s}</button>
          ))}
        </div>
        <input className="input-ui" value={sections.includes(section) ? '' : section} onChange={(e) => setSection(e.target.value)} placeholder="oder neuer Bereich, z. B. Garten" aria-label="Neuer Bereich" />
      </div>
      <input className="input-ui" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel, z. B. WLAN „Casa-Gast“" aria-label="Titel" />
      <input className="input-ui" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Wert, z. B. Passwort, Telefon, Zählerstand" aria-label="Wert" />
      <label className="so__datelabel">
        <span className="so__label">Datum (freiwillig)</span>
        <input className="input-ui" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <textarea className="input-ui" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (freiwillig)" aria-label="Notiz" />
      <Toggle on={hidden} onChange={setHidden} label="Erst nach Antippen zeigen" hint="Für Gäste-WLAN und Ähnliches" />
      <p className="hint">Keine Konto-, Ausweis- oder Kartennummern speichern.</p>
      {err && <span className="hint hint--brown">{err}</span>}
      <div className="so__actions">
        <button type="button" className="so__ok" onClick={() => void go()}>Speichern</button>
        {entry.id && (
          <button type="button" className="so__ghost" onClick={() => (sure ? void remove(entry.id!).then(onClose) : setSure(true))}>{sure ? 'Wirklich entfernen?' : 'Entfernen'}</button>
        )}
      </div>
    </Sheet>
  )
}

const deDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}`

// ---------------------------------------------------------------------------
// Geschenk-Dose
// ---------------------------------------------------------------------------
export function Geschenke() {
  const { me, members } = useCasa()
  const today = useToday()
  const so = useSonstiges()
  const [open, setOpen] = useState<GiftPerson | 'neu' | null>(null)
  const sorted = useMemo(() => {
    const withB = so.people.map((p) => ({ p, d: nextBirthday(p, today) }))
    return [...withB.filter((x) => x.d).sort((a, b) => a.d!.localeCompare(b.d!)), ...withB.filter((x) => !x.d).sort((a, b) => a.p.name.localeCompare(b.p.name))]
  }, [so.people, today])
  const firstId = sorted.find((x) => x.d)?.p.id
  const missing = sorted.filter((x) => !x.d).length
  const other = members.find((m) => m.id !== me?.id && m.role === 'partner')?.display_name ?? 'der andere'

  return (
    <div className="page so">
      <Top title="Geschenk-Dose" />
      <p className="so__lead">Fällt dir was auf? Rein damit. Zwei Wochen vorher erinnere ich euch.</p>
      <div className="so__tear" />
      {sorted.map(({ p }) => {
        const list = so.ideas.filter((i) => i.person_id === p.id && !i.done_at)
        const soon = p.id === firstId
        return (
          <button key={p.id} type="button" className={'so__gift' + (soon ? ' so__gift--soon' : '')} onClick={() => setOpen(p)}>
            <span className="so__gifttop">
              <span className="so__giftname">{p.name}</span>
              {nextBirthday(p, today) && <span className={'so__giftwhen' + (soon ? ' so__giftwhen--soon' : '')}>{birthdayLabel(p, today)}</span>}
            </span>
            {list.map((i) => <span key={i.id} className="so__idea">· {i.text}</span>)}
            {p.member_id && <span className="so__lock">🔒 {p.member_id === me?.id ? `Was ${other} für dich einträgt, siehst du nicht` : 'nur du siehst deine Ideen'}</span>}
          </button>
        )
      })}
      {missing > 0 && <span className="so__empty">{missing === 1 ? '1 Geburtstag fehlt' : `${missing} Geburtstage fehlen`} · bei der Person unter „Geburtstag“ nachtragen</span>}
      <button type="button" className="so__add" onClick={() => setOpen('neu')}>+ Person</button>
      {open && <PersonSheet person={open === 'neu' ? null : open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function PersonSheet({ person, onClose }: { person: GiftPerson | null; onClose: () => void }) {
  const so = useSonstiges()
  const { me } = useCasa()
  const [name, setName] = useState(person?.name ?? '')
  const [day, setDay] = useState(person?.birthday_day ?? 0)
  const [month, setMonth] = useState(person?.birthday_month ?? 0)
  const [year, setYear] = useState(person?.birth_year ? String(person.birth_year) : '')
  const [idea, setIdea] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const list = person ? so.ideas.filter((i) => i.person_id === person.id && !i.done_at) : []
  const save = async () => {
    if (!name.trim()) return setErr('Name fehlt noch.')
    if ((day && !month) || (!day && month)) return setErr('Tag und Monat bitte beide oder keins.')
    const y = year.trim() ? Number(year) : null
    if (y != null && (!Number.isInteger(y) || y < 1900 || y > 2100)) return setErr('Jahr bitte vierstellig oder leer.')
    try {
      await so.savePerson({ id: person?.id, name, birthday_day: day || null, birthday_month: month || null, birth_year: y })
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!person || !idea.trim()) return
    await so.addIdea(person.id, idea)
    setIdea('')
  }
  const [showBday, setShowBday] = useState(!person)
  const otherName = useCasa().members.find((m) => m.id !== me?.id && m.role === 'partner')?.display_name ?? 'Der andere'
  const birthday = (
    <div className="stack" style={{ gap: 6 }}>
      {!person?.member_id && <input className="input-ui" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" />}
      <span className="so__label">Geburtstag (freiwillig)</span>
      <div className="so__bday">
        <select className="input-ui" value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Tag">
          <option value={0}>Tag</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}.</option>)}
        </select>
        <select className="input-ui" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Monat">
          <option value={0}>Monat</option>
          {['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input className="input-ui" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Jahr" aria-label="Jahr (freiwillig)" />
      </div>
      <button type="button" className="so__ok so__ok--small" style={{ alignSelf: 'flex-start' }} onClick={() => void save()}>Speichern</button>
    </div>
  )
  return (
    <Sheet onClose={onClose} title={person ? person.name : 'Neue Person'}>
      <span className="so__sheettitle">{person ? person.name : 'Neue Person'}</span>
      {person ? (
        <>
          {/* Idee zuerst: Feld oben und gleich bereit zum Tippen */}
          <form className="so__ideaform" onSubmit={add}>
            <input className="input-ui" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={`Idee für ${person.name}`} aria-label="Neue Idee" enterKeyHint="done" autoFocus />
            <button type="submit" className="so__ok so__ok--small" disabled={!idea.trim()}>Rein</button>
          </form>
          <span className="so__lock">{person.member_id ? `🔒 Ideen für ${person.name} sieht nur, wer sie einträgt.` : `${otherName} sieht die Idee auch.`}</span>
          {list.length > 0 && (
            <section className="stack" style={{ gap: 4 }}>
              {list.map((i) => (
                <div key={i.id} className="so__idearow">
                  <span className="so__ideatext">{i.text}</span>
                  <button type="button" className="so__ghost" onClick={() => void so.setIdeaDone(i.id, true)} aria-label={`${i.text} verschenkt`}>verschenkt</button>
                  {(i.created_by === me?.id || !person.member_id) && <button type="button" className="so__x" onClick={() => void so.removeIdea(i.id)} aria-label={`${i.text} entfernen`}>×</button>}
                </div>
              ))}
            </section>
          )}
          <button type="button" className="so__fold" aria-expanded={showBday} onClick={() => setShowBday((v) => !v)}>
            Geburtstag{person.birthday_day && person.birthday_month ? ` · ${person.birthday_day}.${person.birthday_month}.` : ' · fehlt'} {showBday ? '▾' : '▸'}
          </button>
          {showBday && birthday}
          {!person.member_id && <button type="button" className="so__ghost" style={{ alignSelf: 'flex-start' }} onClick={() => void so.archivePerson(person.id).then(onClose)}>Aus der Dose nehmen</button>}
        </>
      ) : (
        birthday
      )}
      {err && <span className="hint hint--brown">{err}</span>}
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Casa aufräumen
// ---------------------------------------------------------------------------
export function Aufraeumen() {
  const { settings, updateSettings, members } = useCasa()
  const today = useToday()
  const so = useSonstiges()
  const hidden = settings?.hidden_areas ?? []
  const list = unusedAreas(so.visits, hidden, today)
  const unused = list.filter((a) => a.unused)
  const tracking = trackingDays(today)
  const who = (area: string) => {
    const v = so.visits.filter((x) => x.area === area).sort((a, b) => b.last_at.localeCompare(a.last_at))[0]
    if (!v) return lastOpenedText(null, today)
    return `${lastOpenedText(v.last_at, today)} · ${members.find((m) => m.id === v.member_id)?.display_name ?? ''}`
  }
  const set = (key: string, hide: boolean) => updateSettings({ hidden_areas: hide ? [...new Set([...hidden, key])] : hidden.filter((h) => h !== key) })

  return (
    <div className="page so">
      <Top title="Casa aufräumen" />
      <p className="so__lead">Casa merkt sich, welche Bereiche ihr nutzt. Was 30 Tage niemand geöffnet hat, schlage ich zum Ausblenden vor. Gelöscht wird nie etwas.</p>
      <div className="so__tear" />
      <section className="so__sec">
        <span className="so__label">Seit 30 Tagen ungenutzt</span>
        {unused.length === 0 && <span className="so__empty">{tracking < 30 ? trackingText(today) : 'Nichts. Ihr nutzt alles.'}</span>}
        {unused.map((a) => (
          <div key={a.key} className="so__arearow">
            <span className="so__rowtext"><span className="so__rowtitle">{a.label}</span><span className="so__rowsub">{who(a.key)}</span></span>
            <button type="button" className="so__chip" onClick={() => void set(a.key, true)}>Ausblenden?</button>
          </div>
        ))}
      </section>
      <section className="so__sec">
        <span className="so__label">Alle Bereiche</span>
        {AREAS.map((a) => (
          <div key={a.key} className="so__arearow">
            <span className="so__rowtext"><span className="so__rowtitle">{a.label}</span><span className="so__rowsub">{hidden.includes(a.key) ? 'ausgeblendet (nur bei dir)' : who(a.key)}</span></span>
            <button type="button" className={'so__chip' + (hidden.includes(a.key) ? ' so__chip--on' : '')} onClick={() => void set(a.key, !hidden.includes(a.key))}>{hidden.includes(a.key) ? 'Einblenden' : 'Ausblenden'}</button>
          </div>
        ))}
        <span className="hint">Ausblenden gilt nur für dich. Die Daten bleiben, Einblenden geht jederzeit hier oder in den Einstellungen.</span>
      </section>
      <button type="button" className="so__ok" onClick={() => managerBus.open('Aufräumen')}>🧹 Wochenputz mit dem Manager</button>
    </div>
  )
}
