// Anmeldung mit E-Mail + Passwort: echt über Supabase oder Demo (Max/Anna, beliebiges Passwort)
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface AuthUser {
  id: string
  email: string
}

export interface Auth {
  current(): Promise<AuthUser | null>
  onChange(cb: (u: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** Neues Passwort für den eingeloggten Nutzer (erstes Festlegen oder Ändern) */
  setPassword(password: string): Promise<void>
  signOut(): Promise<void>
}

/** Von index.html gesetzt, wenn die App über einen „Passwort festlegen"-Link geöffnet wurde. */
export function pendingRecovery(): boolean {
  try {
    return sessionStorage.getItem('casa.recovery') === '1'
  } catch {
    return false
  }
}
export function clearRecovery() {
  try {
    sessionStorage.removeItem('casa.recovery')
  } catch {
    /* egal */
  }
}
/** Fehlermeldung aus einem abgelaufenen Link (von index.html gesichert) */
export function takeAuthError(): string | null {
  try {
    const e = sessionStorage.getItem('casa.authError')
    sessionStorage.removeItem('casa.authError')
    return e
  } catch {
    return null
  }
}

function fromSession(s: Session | null): AuthUser | null {
  if (!s?.user) return null
  return { id: s.user.id, email: s.user.email ?? '' }
}

export class SupabaseAuth implements Auth {
  async current() {
    const { data } = await supabase!.auth.getSession()
    return fromSession(data.session)
  }
  onChange(cb: (u: AuthUser | null) => void) {
    const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
      cb(fromSession(session))
      // Nach einem Link-Login steht das Token in der URL – aufräumen.
      if (session && window.location.hash.includes('access_token=')) {
        window.history.replaceState(null, '', window.location.pathname + '#/heute')
      }
    })
    return () => data.subscription.unsubscribe()
  }
  async signIn(email: string, password: string) {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      if (/invalid login credentials|invalid_credentials/i.test(error.message)) {
        throw new Error('E-Mail oder Passwort stimmt nicht.')
      }
      if (/rate limit|too many/i.test(error.message)) {
        throw new Error('Zu viele Versuche. Bitte kurz warten.')
      }
      throw new Error('Das hat nicht geklappt: ' + error.message)
    }
  }
  async setPassword(password: string) {
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) {
      if (/same password|different from the old/i.test(error.message)) throw new Error('Das ist schon dein aktuelles Passwort.')
      if (/weak|at least|should contain/i.test(error.message)) throw new Error('Bitte mindestens 8 Zeichen.')
      throw new Error('Das hat nicht geklappt: ' + error.message)
    }
  }
  async signOut() {
    await supabase!.auth.signOut()
  }
}

export class DemoAuth implements Auth {
  private key = 'casa.demo.user'
  private listeners = new Set<(u: AuthUser | null) => void>()
  private read(): AuthUser | null {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? 'null')
    } catch {
      return null
    }
  }
  private set(u: AuthUser | null) {
    if (u) localStorage.setItem(this.key, JSON.stringify(u))
    else localStorage.removeItem(this.key)
    this.listeners.forEach((l) => l(u))
  }
  async current() {
    return this.read()
  }
  onChange(cb: (u: AuthUser | null) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  async signIn(email: string) {
    const e = email.trim().toLowerCase()
    if (e !== 'max@beispiel.de' && e !== 'anna@beispiel.de') {
      throw new Error('E-Mail oder Passwort stimmt nicht.')
    }
    this.set({ id: e.startsWith('max') ? 'demo-max' : 'demo-anna', email: e })
  }
  async setPassword() {
    /* Demo: nichts zu tun */
  }
  async signOut() {
    this.set(null)
  }
}
