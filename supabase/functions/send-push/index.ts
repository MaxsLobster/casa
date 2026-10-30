// Casa · Edge Function „send-push"
// Verschickt fällige Mitteilungen aus public.notifications per Web Push.
// Aufruf: minütlich von pg_cron (Header x-cron-key) oder aus der App mit Nutzer-JWT (nach eigenen Einträgen).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:casa@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

interface Notification {
  id: string
  recipient_member_id: string
  kind: string
  title: string
  body: string
  url: string
}
interface Subscription {
  id: string
  member_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-key' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json(200, { ok: true })

  // Wer ruft? Cron (mit Schlüssel) oder ein eingeloggtes Mitglied.
  const cronKey = req.headers.get('x-cron-key')
  let allowed = CRON_SECRET !== '' && cronKey === CRON_SECRET
  if (!allowed) {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
      const { data } = await userClient.auth.getUser()
      allowed = !!data.user
    }
  }
  if (!allowed) return json(401, { error: 'nicht erlaubt' })

  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: pending, error } = await db
    .from('notifications')
    .select('id, recipient_member_id, kind, title, body, url')
    .is('sent_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('created_at')
    .limit(200)
  if (error) return json(500, { error: error.message })
  if (!pending || pending.length === 0) return json(200, { sent: 0 })

  // Pro Empfänger bündeln (nach Ruhezeiten kommt alles gesammelt)
  const byMember = new Map<string, Notification[]>()
  for (const n of pending as Notification[]) byMember.set(n.recipient_member_id, [...(byMember.get(n.recipient_member_id) ?? []), n])

  let sent = 0
  let failed = 0
  for (const [memberId, list] of byMember) {
    const { data: subs } = await db.from('push_subscriptions').select('id, member_id, endpoint, p256dh, auth').eq('member_id', memberId)
    const ids = list.map((n) => n.id)
    if (!subs || subs.length === 0) {
      await db.from('notifications').update({ sent_at: new Date().toISOString(), error: 'kein Gerät angemeldet' }).in('id', ids)
      continue
    }

    const payload =
      list.length === 1
        ? { title: list[0].title, body: list[0].body, url: list[0].url, tag: list[0].kind + ':' + list[0].id }
        : {
            title: `Casa · ${list.length} Neuigkeiten`,
            body: list.map((n) => n.body).join(' · ').slice(0, 300),
            url: list.every((n) => n.url === list[0].url) ? list[0].url : '#/heute',
            tag: 'casa-bundle',
          }

    let anyOk = false
    let lastErr = ''
    for (const s of subs as Subscription[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'normal' })
        anyOk = true
        await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        lastErr = `${status ?? ''} ${(e as Error).message}`.trim()
        if (status === 404 || status === 410) {
          // Gerät hat das Abo gekündigt → entfernen
          await db.from('push_subscriptions').delete().eq('id', s.id)
        }
      }
    }
    await db
      .from('notifications')
      .update({ sent_at: new Date().toISOString(), error: anyOk ? null : lastErr || 'Versand fehlgeschlagen' })
      .in('id', ids)
    if (anyOk) sent += list.length
    else failed += list.length
  }
  return json(200, { sent, failed })
})
