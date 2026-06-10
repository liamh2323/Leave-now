import { createServerClient } from './supabase'

export async function fetchAndCacheTripUpdates(
  targetStopIds: string[]
): Promise<void> {
  const apiKey = process.env.GTFS_RT_API_KEY
  const feedUrl = process.env.GTFS_RT_FEED_URL

  if (!apiKey || !feedUrl || targetStopIds.length === 0) {
    return
  }

  const supabase = createServerClient()

  // 1. Fetch the GTFS-RT TripUpdates protobuf
  // NTA's certificate chain isn't trusted by Node's default CA bundle,
  // so we use undici with rejectUnauthorized: false for this request only.
  const { fetch: undiciFetch, Agent } = await import('undici')
  const agent = new Agent({ connect: { rejectUnauthorized: false } })
  const res = await undiciFetch(feedUrl, {
    headers: { 'x-api-key': apiKey },
    dispatcher: agent,
  })
  if (!res.ok) {
    throw new Error(`GTFS-RT fetch failed: ${res.status} ${res.statusText}`)
  }
  const buffer = await res.arrayBuffer()

  // 2. Decode the protobuf
  const { transit_realtime } = await import('gtfs-realtime-bindings')
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer))

  // 3. Extract StopTimeUpdates for our stops
  const rows: { trip_id: string; stop_id: string; delay_seconds: number; updated_at: string }[] = []
  const now = new Date().toISOString()

  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate
    if (!tripUpdate?.trip?.tripId) continue

    for (const stu of tripUpdate.stopTimeUpdate ?? []) {
      if (!stu.stopId || !targetStopIds.includes(stu.stopId)) continue
      const delay = stu.departure?.delay ?? stu.arrival?.delay ?? 0
      rows.push({
        trip_id: tripUpdate.trip.tripId,
        stop_id: stu.stopId,
        delay_seconds: Number(delay),
        updated_at: now,
      })
    }
  }

  // 4. Upsert delay rows
  if (rows.length > 0) {
    await supabase
      .from('trip_delays')
      .upsert(rows, { onConflict: 'trip_id,stop_id' })
  }

  // 5. Purge stale rows older than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  await supabase.from('trip_delays').delete().lt('updated_at', fiveMinutesAgo)
}
