// Stage 3: push notification delivery via web-push (VAPID).
// Run `npm install web-push && npm install -D @types/web-push` before using.
// Generate keys with: npx web-push generate-vapid-keys

import type { PushPayload } from '@/types/gtfs'

// Lazy-load web-push so Stage 1/2 don't fail if it's not installed yet.
async function getWebPush() {
  try {
    const webpush = await import('web-push')
    const mod = webpush.default ?? webpush
    mod.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    return mod
  } catch {
    throw new Error(
      'web-push is not installed. Run: npm install web-push && npm install -D @types/web-push'
    )
  }
}

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<void> {
  const webpush = await getWebPush()
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    { TTL: 300 } // 5 minute time-to-live — irrelevant after the bus leaves
  )
}

export async function broadcastPush(payload: PushPayload): Promise<void> {
  const { createServerClient } = await import('./supabase')
  const supabase = createServerClient()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (!subscriptions || subscriptions.length === 0) return

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await sendPush(sub, payload)
      } catch (err: any) {
        // 410 Gone: subscription has been revoked — clean it up
        if (err?.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        } else {
          console.error('[push] send failed for', sub.endpoint, err?.message)
        }
      }
    })
  )
}
