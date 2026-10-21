// Anmeldung: echt über Supabase (Magic Link + Code) oder Demo (Max/Anna auswählen)
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface AuthUser {
  id: string
  email: string
}

export interface Auth {
  current(): Promise<AuthUser | null>
  onChange(cb: (u: AuthUser | null) => void): () => void
  /** Schickt den Link/Code. Wirft bei nicht freigeschalteter Adresse. */
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
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
      // Nach einem Magic-Link-Login steht das Token in der URL – aufräumen.
      if (session && window.location.hash.includes('access_token=')) {
        window.history.replaceState(null, '', window.location.pathname + '#/heute')
      }
    })
    return () => data.subscription.unsubscribe()
  }
  async sendCode(email: string) {
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      // „Database error saving new user" = unser Trigger hat die Adresse abgelehnt
      if (/database error|not allowed|freigeschaltet/i.test(error.message)) {
        throw new Error('Diese Adresse ist für Casa nicht freigeschaltet.')
      }
      if (/rate limit|security purposes/i.test(error.message)) {
        throw new Error('Bitte kurz warten, bevor du einen neuen Link anforderst.')
      }
      throw new Error('Das hat nicht geklappt: ' + error.message)
    }
  }
  async verifyCode(email: string, code: string) {
    const { error } = await supabase!.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    if (error) throw new Error('Der Code stimmt nicht oder ist abgelaufen.')
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
  async sendCode(email: string) {
    const e = email.trim().toLowerCase()
    if (e !== 'max@beispiel.de' && e !== 'anna@beispiel.de') {
      throw new Error('Diese Adresse ist für Casa nicht freigeschaltet.')
    }
  }
  async verifyCode(email: string) {
    const e = email.trim().toLowerCase()
    this.set({ id: e.startsWith('max') ? 'demo-max' : 'demo-anna', email: e })
  }
  async signOut() {
    this.set(null)
  }
}
