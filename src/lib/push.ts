import webpush from 'web-push'
import type { PushPayload } from '@/types/gtfs'

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<void> {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    { TTL: 300 }
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
