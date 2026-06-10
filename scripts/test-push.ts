/**
 * Send a test push notification to all stored subscriptions.
 * Usage: npm run test-push
 *
 * Requires web-push to be installed (Stage 3):
 *   npm install web-push && npm install -D @types/web-push
 *
 * Required env vars: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 *                    VAPID_SUBJECT, plus Supabase vars.
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  let webpush: any
  try {
    // @ts-ignore — web-push installed in Stage 3
    webpush = (await import('web-push')).default ?? (await import('web-push'))
  } catch {
    console.error('web-push not installed. Run: npm install web-push && npm install -D @types/web-push')
    process.exit(1)
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_label')

  if (error || !subs?.length) {
    console.error('No subscriptions found. Enable notifications in the PWA first.')
    process.exit(1)
  }

  console.log(`Sending test push to ${subs.length} subscription(s)…`)

  const payload = JSON.stringify({
    title: 'Leave Now — test notification',
    body: 'Push notifications are working! 🚌',
    tag: 'test-' + Date.now(),
    timestamp: Date.now(),
  })

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      console.log(`✓ Sent to ${sub.user_label ?? sub.endpoint.slice(-20)}`)
    } catch (err: any) {
      console.error(`✗ Failed (${err.statusCode}): ${err.body ?? err.message}`)
      if (err.statusCode === 410) {
        console.log('  → Subscription expired, removing from DB')
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }
}

main().catch(console.error)
