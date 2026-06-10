import { createServerClient } from './supabase'

// Stage 1: this module is a no-op if GTFS_RT_API_KEY is not set.
// Stage 2: fill in the fetch + decode logic after obtaining your NTA API key.

export async function fetchAndCacheTripUpdates(
  targetStopIds: string[]
): Promise<void> {
  const apiKey = process.env.GTFS_RT_API_KEY
  const feedUrl = process.env.GTFS_RT_FEED_URL

  if (!apiKey || !feedUrl) {
    // No key yet — silently skip
    return
  }

  // --- Stage 2 implementation goes here ---
  // 1. Fetch the GTFS-R TripUpdates protobuf:
  //    const res = await fetch(feedUrl, { headers: { 'x-api-key': apiKey } })
  //    const buffer = await res.arrayBuffer()
  //
  // 2. Decode with gtfs-realtime-bindings:
  //    const { transit_realtime } = await import('gtfs-realtime-bindings')
  //    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer))
  //
  // 3. Extract StopTimeUpdates for targetStopIds and upsert into trip_delays:
  //    const rows = []
  //    for (const entity of feed.entity) {
  //      const tripUpdate = entity.tripUpdate
  //      if (!tripUpdate) continue
  //      for (const stu of tripUpdate.stopTimeUpdate ?? []) {
  //        if (!targetStopIds.includes(stu.stopId)) continue
  //        rows.push({
  //          trip_id: tripUpdate.trip.tripId,
  //          stop_id: stu.stopId,
  //          delay_seconds: stu.departure?.delay ?? stu.arrival?.delay ?? 0,
  //          updated_at: new Date().toISOString(),
  //        })
  //      }
  //    }
  //    if (rows.length > 0) {
  //      await supabase.from('trip_delays').upsert(rows, { onConflict: 'trip_id,stop_id' })
  //    }
  //
  // 4. Purge stale rows (older than 5 minutes):
  //    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  //    await supabase.from('trip_delays').delete().lt('updated_at', fiveMinutesAgo)
}
