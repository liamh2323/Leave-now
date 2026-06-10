export interface Stop {
  stop_id: string
  stop_name: string
  stop_lat: number | null
  stop_lon: number | null
}

export interface UserStop {
  id: number
  stop_id: string
  walk_minutes: number | null
  walk_minutes_override: number | null
  label: string | null
  // joined from stops table
  stop_name?: string
  stop_lat?: number | null
  stop_lon?: number | null
}

export interface UserSettings {
  id: number
  walk_pace_min_per_km: number
  origin_lat: number | null
  origin_lon: number | null
}

export interface Departure {
  tripId: string
  routeShortName: string      // "39A"
  tripHeadsign: string
  stopId: string
  scheduledSeconds: number    // seconds since midnight (Dublin tz)
  delaySeconds: number
  actualDepartureTime: Date   // wall-clock, Dublin tz
  leaveByTime: Date           // actualDepartureTime minus walk minutes
  leaveInMinutes: number      // minutes from now (negative = already gone)
}

export interface PushPayload {
  title: string
  body: string
  tag: string
  timestamp: number           // ms epoch
}
