// Web Push im Browser: Abo anlegen/aufheben, Gerätestatus prüfen

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Läuft die App vom Home-Bildschirm (ohne Browserleiste)? Nur dann geht Push auf dem iPhone. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function permissionState(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export interface PushKeys {
  endpoint: string
  p256dh: string
  auth: string
}

function toKeys(sub: PushSubscription): PushKeys {
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error('Abo unvollständig')
  return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }
}

/** Fragt die Erlaubnis ab (muss durch einen Tipp ausgelöst werden) und legt das Abo an. */
export async function subscribePush(vapidPublicKey: string): Promise<PushKeys> {
  if (!pushSupported()) throw new Error('Dieses Gerät oder dieser Browser kann keine Mitteilungen.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Mitteilungen wurden nicht erlaubt.')
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return toKeys(existing)
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })
  return toKeys(sub)
}

export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentPushSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return endpoint
}
