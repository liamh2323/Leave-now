// Walking time calculation utilities.
// Used to auto-calculate walk_minutes when the user sets their origin coords.

const EARTH_RADIUS_KM = 6371

// Haversine formula: straight-line distance in km between two lat/lon points.
// Good enough for walking distances (< 5km). Does not account for street layout.
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

// Calculate walk minutes from pace and coordinates.
// Rounds to the nearest 0.5 minutes (e.g. 6.0, 6.5, 7.0).
export function calcWalkMinutes(
  stopLat: number,
  stopLon: number,
  originLat: number,
  originLon: number,
  paceMinPerKm: number
): number {
  const distanceKm = haversineKm(originLat, originLon, stopLat, stopLon)
  const rawMinutes = distanceKm * paceMinPerKm
  // Round to nearest 0.5, minimum 1 minute
  return Math.max(1, Math.round(rawMinutes * 2) / 2)
}

// Effective walk minutes for a user_stop: override > calculated > default
export function effectiveWalkMinutes(
  walkMinutesOverride: number | null,
  walkMinutes: number | null,
  defaultMinutes = 10
): number {
  return walkMinutesOverride ?? walkMinutes ?? defaultMinutes
}

// Preset pace descriptions for the UI
export const WALK_PACE_PRESETS = [
  { label: 'Leisurely', minPerKm: 14 },
  { label: 'Average',   minPerKm: 12 },
  { label: 'Brisk',     minPerKm: 10 },
  { label: 'Fast',      minPerKm: 8 },
] as const
