// All time helpers operate in the Europe/Dublin timezone.
// Dublin uses IST (UTC+1) in summer and GMT (UTC+0) in winter — do NOT
// use hardcoded UTC offsets. Always use Intl.DateTimeFormat.

const DUBLIN_TZ = 'Europe/Dublin'

// Convert a GTFS departure_time string to seconds since midnight.
// GTFS allows post-midnight values like "25:30:00" (= 01:30 next day).
export function gtfsTimeToSeconds(gtfsTime: string): number {
  const [h, m, s] = gtfsTime.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}

// Current time as seconds since midnight in the Dublin timezone.
export function nowInDublinSeconds(): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: DUBLIN_TZ,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)

  const hours = get('hour')
  const minutes = get('minute')
  const seconds = get('second')

  // Handle midnight: Intl may return hour=24 for 00:00
  return (hours === 24 ? 0 : hours) * 3600 + minutes * 60 + seconds
}

// Today's date as a "YYYYMMDD" string in the Dublin timezone.
// Used to query calendar / calendar_dates tables.
export function todayInDublin(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: DUBLIN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00'

  return `${get('year')}${get('month')}${get('day')}`
}

// Today as an ISO date string "YYYY-MM-DD" in Dublin timezone.
// Used in SQL queries against date columns.
export function todayISOInDublin(): string {
  const ymd = todayInDublin()
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

// Day of week index in Dublin timezone: 0 = Sunday, 6 = Saturday.
export function dublinDayOfWeek(): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: DUBLIN_TZ,
    weekday: 'short',
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return map[weekday] ?? 0
}

// Convert seconds-since-midnight to a wall-clock Date in Dublin tz.
// date defaults to today; pass a specific Date to anchor to another day.
export function secondsToDate(
  secondsSinceMidnight: number,
  anchor?: Date
): Date {
  const base = anchor ?? new Date()
  const isoDate = todayISOInDublin()

  // Build a Date from the Dublin date at midnight UTC, then add seconds.
  // We offset by the Dublin tz offset at that moment.
  const midnight = new Date(`${isoDate}T00:00:00`)
  const dublinMidnightOffset = getDublinMidnightOffsetMs(midnight)
  return new Date(midnight.getTime() - dublinMidnightOffset + secondsSinceMidnight * 1000)
}

// Format a Date as "HH:MM" in Dublin timezone (e.g. "14:23").
export function formatDublinTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: DUBLIN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

// Returns the Dublin timezone offset in ms at midnight of the given date.
// Used to correctly anchor "seconds since midnight" to a wall clock.
function getDublinMidnightOffsetMs(midnightUTC: Date): number {
  // Create a formatter that shows the UTC offset for Dublin at a given moment
  const formatter = new Intl.DateTimeFormat('en-IE', {
    timeZone: DUBLIN_TZ,
    timeZoneName: 'shortOffset',
  })
  const formatted = formatter.format(midnightUTC)
  // Extract offset like "GMT+1" or "GMT"
  const match = formatted.match(/GMT([+-]\d+)?/)
  if (!match) return 0
  const offsetHours = match[1] ? parseInt(match[1], 10) : 0
  return offsetHours * 3600 * 1000
}
