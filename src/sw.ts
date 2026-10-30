/// <reference lib="webworker" />
// Service Worker: Offline-Start der App + Web Push
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// App-Shell für alle Navigationen (Hash-Routing → immer index.html)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Google Fonts: einmal laden, dann aus dem Cache
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'casa-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// Supabase nie cachen
registerRoute(({ url }) => url.hostname.endsWith('.supabase.co'), new NetworkOnly())

// --- Web Push -------------------------------------------------------------

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Casa', {
      body: data.body ?? '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url ?? '#/heute' },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '#/heute'
  // scope endet mit "/casa/" → volle Adresse der passenden Stelle in der App
  const full = new URL(target, self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope)) {
          try {
            if ('navigate' in c) await (c as WindowClient).navigate(full)
          } catch {
            /* dann wenigstens in den Vordergrund */
          }
          return c.focus()
        }
      }
      return self.clients.openWindow(full)
    }),
  )
})
