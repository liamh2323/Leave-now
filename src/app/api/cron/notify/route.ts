import { NextRequest, NextResponse } from 'next/server'
import { getAllUserStopDepartures } from '@/lib/gtfs-static'
import { formatDublinTime } from '@/lib/time'
import type { Departure, PushPayload } from '@/types/gtfs'

export const dynamic = 'force-dynamic'

// Vercel Cron: called every minute.
// Evaluates upcoming departures for each configured stop and fires push
// notifications when it's time to leave.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stopResults = await getAllUserStopDepartures()
  const notified: string[] = []
  const pushed: string[] = []

  for (const { stopId, label, walkMinutes, departures } of stopResults) {
    for (const dep of departures) {
      if (!shouldNotify(dep)) continue

      const payload = buildNotificationPayload(dep, label ?? stopId)
      notified.push(payload.tag)

      // Import push lazily — only needed once keys are set up
      try {
        const { broadcastPush } = await import('@/lib/push')
        await broadcastPush(payload)
        pushed.push(payload.tag)
      } catch (err) {
        console.error('[cron/notify] push failed:', err)
      }
    }
  }

  return NextResponse.json({ ok: true, notified, pushed, ts: Date.now() })
}

// Fire if the user needs to leave within the next -1 to +3 minutes.
// Generous window + tag-based dedup in the service worker handles
// the ~10s jitter inherent in Vercel Cron timing.
function shouldNotify(dep: Departure): boolean {
  return dep.leaveInMinutes >= -1 && dep.leaveInMinutes <= 3
}

function buildNotificationPayload(dep: Departure, stopLabel: string): PushPayload {
  const leaveIn = Math.round(dep.leaveInMinutes)
  const departureStr = formatDublinTime(dep.actualDepartureTime)
  const delayNote =
    dep.delaySeconds > 60
      ? ` (${Math.round(dep.delaySeconds / 60)} min late)`
      : dep.delaySeconds < -60
        ? ` (${Math.abs(Math.round(dep.delaySeconds / 60))} min early)`
        : ''

  const title =
    leaveIn <= 0
      ? 'Leave now!'
      : `Leave in ${leaveIn} minute${leaveIn === 1 ? '' : 's'}`

  const body = `Catch the ${dep.routeShortName} at ${departureStr}${delayNote} — ${stopLabel}`

  // Tag deduplicates: same trip at the same scheduled minute won't stack
  const scheduledMinute = Math.floor(dep.scheduledSeconds / 60)
  const tag = `trip-${dep.tripId}-${scheduledMinute}`

  return { title, body, tag, timestamp: Date.now() }
}
