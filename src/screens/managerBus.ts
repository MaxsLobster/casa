// Kleiner Kanal zum Casa-Manager-Blatt: öffnen (optional mit Frage), Eingabefeld fokussieren.
// Synchron aufgerufen, damit iOS die Tastatur noch in derselben Geste öffnet.
type Handler = { open: (ask?: string) => void; openAndFocus: (hint?: string) => void }
let handler: Handler | null = null
let pending: string | null = null

export const managerBus = {
  register(h: Handler) {
    handler = h
    if (pending !== null) {
      const p = pending
      pending = null
      h.open(p || undefined)
    }
    return () => {
      if (handler === h) handler = null
    }
  },
  open(ask?: string) {
    if (handler) handler.open(ask)
    else pending = ask ?? ''
  },
  openAndFocus(hint?: string) {
    if (handler) handler.openAndFocus(hint)
    else pending = ''
  },
}

// ---------------------------------------------------------------------------
// Spracherkennung im Browser (SpeechRecognition / webkitSpeechRecognition, Deutsch)
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null
const KEY = 'casa.speech'

/** 'ok' = klappt hier, 'off' = klappt hier nicht (dann Diktat über die Tastatur), null = noch nicht probiert */
export function speechState(): 'ok' | 'off' | null {
  if (!SR) return 'off'
  try {
    const v = localStorage.getItem(KEY)
    return v === 'ok' || v === 'off' ? v : null
  } catch {
    return null
  }
}
function remember(v: 'ok' | 'off') {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* egal */
  }
}

export interface Listening {
  stop: () => void
}

/** Startet die Erkennung. onText bekommt Zwischenstände, onDone den Endtext (leer = nichts verstanden), onFail wenn es hier nicht geht. */
export function listen(onText: (t: string) => void, onDone: (t: string) => void, onFail: () => void): Listening | null {
  if (!SR) return null
  let rec: any
  try {
    rec = new SR()
  } catch {
    remember('off')
    return null
  }
  rec.lang = 'de-DE'
  rec.continuous = true
  rec.interimResults = true
  let text = ''
  let failed = false
  let heard = false
  rec.onresult = (e: any) => {
    heard = true
    let all = ''
    for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript
    text = all.trim()
    onText(text)
  }
  rec.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture' || e.error === 'network') {
      failed = true
      remember('off')
      onFail()
    }
  }
  rec.onend = () => {
    if (failed) return
    if (heard) remember('ok')
    onDone(text)
  }
  try {
    rec.start()
  } catch {
    remember('off')
    return null
  }
  return {
    stop: () => {
      try {
        rec.stop()
      } catch {
        /* schon aus */
      }
    },
  }
}
