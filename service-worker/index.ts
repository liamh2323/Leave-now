/// <reference lib="webworker" />
// Custom service worker logic compiled by @ducanh2912/next-pwa.
// This file handles push notifications and notification clicks.
// It is merged with the auto-generated next-pwa service worker.

declare const self: ServiceWorkerGlobalScope

// Push event: show a notification from the payload sent by /api/cron/notify
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: {
    title: string
    body: string
    tag: string
    timestamp: number
  }

  try {
    payload = event.data.json()
  } catch {
    // Malformed payload — ignore
    return
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,          // Deduplicates: same tag replaces previous notification
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      timestamp: payload.timestamp,
      // Keep notification silent if user has already left (timestamp > 3 min ago)
      silent: Date.now() - payload.timestamp > 3 * 60 * 1000,
      data: { url: '/' },
    })
  )
})

// Notification click: open or focus the PWA window
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data?.url as string) ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl)
      })
  )
})
