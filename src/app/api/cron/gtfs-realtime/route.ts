import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Vercel Cron: called every minute.
// Stage 2: when GTFS_RT_API_KEY is set, fetches live TripUpdates and caches delays.
// Stage 1: no-op — returns { skipped: true }.
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GTFS_RT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ skipped: true, reason: 'No GTFS_RT_API_KEY set' })
  }

  // Stage 2: import and run the realtime fetcher
  const { fetchAndCacheTripUpdates } = await import('@/lib/gtfs-realtime')
  const targetStopIds = (process.env.TARGET_STOP_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  await fetchAndCacheTripUpdates(targetStopIds)

  return NextResponse.json({ ok: true, ts: Date.now() })
}
