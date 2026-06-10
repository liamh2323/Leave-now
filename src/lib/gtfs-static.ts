import { createServerClient } from './supabase'
import {
  gtfsTimeToSeconds,
  nowInDublinSeconds,
  todayISOInDublin,
  dublinDayOfWeek,
  secondsToDate,
} from './time'
import { effectiveWalkMinutes } from './walk'
import type { Departure } from '@/types/gtfs'

const DOW_COLUMN = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const

// Returns upcoming departures for a stop, with live delays merged in.
// walk is the effective walk time (minutes) to this stop.
export async function getUpcomingDepartures(
  stopId: string,
  walkMinutes: number,
  limit = 5
): Promise<Departure[]> {
  const supabase = createServerClient()
  const today = todayISOInDublin()
  const nowSeconds = nowInDublinSeconds()
  const dow = dublinDayOfWeek()
  const dowCol = DOW_COLUMN[dow]

  // Step 1: active service IDs for today
  const activeServiceIds = await getActiveServiceIds(supabase, today, dowCol)
  if (activeServiceIds.length === 0) return []

  // Step 2: fetch upcoming stop_times joined to trips + routes
  const { data: rows, error } = await supabase
    .from('stop_times')
    .select(`
      trip_id,
      departure_time,
      stop_sequence,
      trips!inner (
        route_id,
        trip_headsign,
        service_id,
        routes!inner ( route_short_name )
      )
    `)
    .eq('stop_id', stopId)
    .in(
      'trips.service_id',
      activeServiceIds
    )
    .order('departure_time', { ascending: true })
    .limit(50) // fetch more than needed; we filter by time below

  if (error) {
    console.error('[gtfs-static] stop_times query error:', error.message)
    return []
  }

  if (!rows || rows.length === 0) return []

  // Step 3: fetch any live delays for this stop
  const tripIds = rows.map((r) => r.trip_id)
  const { data: delays } = await supabase
    .from('trip_delays')
    .select('trip_id, delay_seconds')
    .eq('stop_id', stopId)
    .in('trip_id', tripIds)

  const delayMap = new Map<string, number>()
  for (const d of delays ?? []) {
    delayMap.set(d.trip_id, d.delay_seconds)
  }

  // Step 4: merge, filter to upcoming, build Departure objects
  const departures: Departure[] = []

  for (const row of rows) {
    const scheduledSeconds = gtfsTimeToSeconds(row.departure_time)
    const delaySeconds = delayMap.get(row.trip_id) ?? 0
    const actualSeconds = scheduledSeconds + delaySeconds

    // Skip departures that have already left (with a 30-second grace window)
    if (actualSeconds < nowSeconds - 30) continue

    const actualDepartureTime = secondsToDate(actualSeconds)
    const leaveByTime = new Date(
      actualDepartureTime.getTime() - walkMinutes * 60 * 1000
    )
    const leaveInMinutes =
      (leaveByTime.getTime() - Date.now()) / 60000

    const trip = row.trips as any
    const route = trip?.routes as any

    departures.push({
      tripId: row.trip_id,
      routeShortName: route?.route_short_name ?? '?',
      tripHeadsign: trip?.trip_headsign ?? '',
      stopId,
      scheduledSeconds,
      delaySeconds,
      actualDepartureTime,
      leaveByTime,
      leaveInMinutes,
    })

    if (departures.length >= limit) break
  }

  return departures
}

// Returns the set of service_ids active on a given date.
async function getActiveServiceIds(
  supabase: ReturnType<typeof createServerClient>,
  today: string,           // "YYYY-MM-DD"
  dowCol: typeof DOW_COLUMN[number]
): Promise<string[]> {
  // Regular services: active on this day-of-week, within date range
  const { data: regular } = await supabase
    .from('calendar')
    .select('service_id')
    .eq(dowCol, true)
    .lte('start_date', today)
    .gte('end_date', today)

  const activeSet = new Set((regular ?? []).map((r) => r.service_id))

  // calendar_dates exceptions for today
  const { data: exceptions } = await supabase
    .from('calendar_dates')
    .select('service_id, exception_type')
    .eq('date', today)

  for (const ex of exceptions ?? []) {
    if (ex.exception_type === 1) {
      // Added service
      activeSet.add(ex.service_id)
    } else if (ex.exception_type === 2) {
      // Removed service
      activeSet.delete(ex.service_id)
    }
  }

  return Array.from(activeSet)
}

// Convenience: get departures for all user stops at once.
export async function getAllUserStopDepartures(): Promise<
  Array<{ stopId: string; label: string | null; walkMinutes: number; departures: Departure[] }>
> {
  const supabase = createServerClient()

  const { data: userStops } = await supabase
    .from('user_stops')
    .select('id, stop_id, walk_minutes, walk_minutes_override, label')

  if (!userStops || userStops.length === 0) return []

  const results = await Promise.all(
    userStops.map(async (us) => {
      const walk = effectiveWalkMinutes(us.walk_minutes_override, us.walk_minutes)
      const departures = await getUpcomingDepartures(us.stop_id, walk, 5)
      return {
        stopId: us.stop_id,
        label: us.label,
        walkMinutes: walk,
        departures,
      }
    })
  )

  return results
}
