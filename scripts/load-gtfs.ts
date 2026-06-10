/**
 * Load static GTFS data into Supabase.
 *
 * Usage: npm run load-gtfs
 *
 * Required env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   GTFS_ZIP_URL        — URL to the GTFS zip file
 *   TARGET_STOP_IDS     — comma-separated list of stop IDs to load
 *
 * Strategy (three passes over stop_times.txt, which is the large file):
 *
 *   Pass 1 — stream stop_times.txt to collect relevantTripIds
 *   Pass 2 — scan trips.txt to collect routeIds + serviceIds (no insert yet)
 *   Then load in FK-safe order:
 *     stops → routes → trips → calendar → calendar_dates → stop_times
 *
 * On re-run: static tables are truncated and reloaded (weekly refresh).
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parse as csvParse } from 'csv-parse'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'

// ---- Load .env.local --------------------------------------------------------

import { config } from 'dotenv'
config({ path: join(process.cwd(), '.env.local') })

// ---- Config -----------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const GTFS_ZIP_URL = process.env.GTFS_ZIP_URL!
const TARGET_STOP_IDS_RAW = process.env.TARGET_STOP_IDS ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}
if (!GTFS_ZIP_URL) {
  console.error('❌ Missing GTFS_ZIP_URL in env')
  process.exit(1)
}

const TARGET_STOP_IDS = new Set(
  TARGET_STOP_IDS_RAW.split(',').map((s) => s.trim()).filter(Boolean)
)

if (TARGET_STOP_IDS.size === 0) {
  console.error('❌ TARGET_STOP_IDS is empty — add at least one stop ID to .env.local')
  process.exit(1)
}

const BATCH_SIZE = 500
const TMP_DIR = join(process.cwd(), '.gtfs-tmp')

// ---- Supabase client --------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ---- Download / copy --------------------------------------------------------

import { copyFileSync } from 'fs'

async function download(urlOrPath: string, dest: string): Promise<void> {
  // Support local file paths as well as http/https URLs
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    console.log(`\nUsing local file: ${urlOrPath}`)
    copyFileSync(urlOrPath, dest)
    return
  }

  console.log(`\nDownloading ${urlOrPath} …`)
  return new Promise((resolve, reject) => {
    const protocol = urlOrPath.startsWith('https') ? https : http
    const file = createWriteStream(dest)
    const request = protocol.get(urlOrPath, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        return download(res.headers.location!, dest).then(resolve).catch(reject)
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    })
    request.on('error', reject)
  })
}

// ---- Unzip ------------------------------------------------------------------

import AdmZip from 'adm-zip'

function unzip(zipPath: string, outDir: string): void {
  console.log('Extracting zip …')
  mkdirSync(outDir, { recursive: true })
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(outDir, true)
  console.log('Extraction complete.')
}

// ---- CSV streaming ----------------------------------------------------------

async function streamCSV(
  filePath: string,
  rowFn: (row: Record<string, string>) => Promise<void> | void
): Promise<void> {
  const parser = csvParse({ columns: true, skip_empty_lines: true, trim: true })
  const stream = createReadStream(filePath)

  await new Promise<void>((resolve, reject) => {
    stream.on('error', reject)
    parser.on('error', reject)
    parser.on('end', resolve)

    stream.pipe(parser)

    // Use async iteration to handle backpressure
    ;(async () => {
      for await (const record of parser) {
        await rowFn(record)
      }
    })().catch(reject)
  })
}

// ---- Batch insert (no upsert — tables are truncated before load) ------------

async function batchInsert(
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`\n[${table}] insert error at offset ${i}:`, error.message)
      throw error
    }
  }
  console.log(`  ✓ ${table}: ${rows.length} rows loaded`)
}

async function truncate(tables: string[]): Promise<void> {
  // Truncate in reverse FK order
  for (const table of tables) {
    const { error } = await supabase.rpc('truncate_table', { tbl: table })
    if (error) {
      // rpc may not exist — fall back to delete
      const { error: delErr } = await supabase.from(table).delete().neq('id', 0)
      if (delErr) {
        // Try text PK tables (stops, routes, etc. don't have integer id)
        const { error: delErr2 } = await (supabase.from(table) as any)
          .delete()
          .not('stop_id', 'is', null)
          .catch(() => ({ error: delErr2 }))
        if (delErr2) {
          console.warn(`  Warning: could not clear ${table}: ${delErr.message}`)
        }
      }
    }
  }
}

// ---- Phase 1: collect relevant trip IDs -------------------------------------

async function collectTripIds(stopTimesPath: string): Promise<Set<string>> {
  console.log('\nPass 1: scanning stop_times.txt for target stop IDs …')
  const tripIds = new Set<string>()
  let scanned = 0

  await streamCSV(stopTimesPath, (row) => {
    scanned++
    if (scanned % 500_000 === 0) {
      process.stdout.write(`  ${(scanned / 1_000_000).toFixed(1)}M rows scanned…\r`)
    }
    if (TARGET_STOP_IDS.has(row.stop_id)) {
      tripIds.add(row.trip_id)
    }
  })

  console.log(`\n  Scanned ${scanned.toLocaleString()} rows → ${tripIds.size} relevant trips`)
  return tripIds
}

// ---- Phase 2: collect route + service IDs from trips -----------------------

async function collectRouteAndServiceIds(
  tripsPath: string,
  tripIds: Set<string>
): Promise<{ routeIds: Set<string>; serviceIds: Set<string> }> {
  console.log('\nPass 2: scanning trips.txt …')
  const routeIds = new Set<string>()
  const serviceIds = new Set<string>()

  await streamCSV(tripsPath, (row) => {
    if (!tripIds.has(row.trip_id)) return
    routeIds.add(row.route_id)
    serviceIds.add(row.service_id)
  })

  console.log(`  Found ${routeIds.size} routes, ${serviceIds.size} service IDs`)
  return { routeIds, serviceIds }
}

// ---- Loaders ----------------------------------------------------------------

async function loadStops(stopsPath: string): Promise<void> {
  console.log('\nLoading stops …')
  const rows: Record<string, unknown>[] = []

  await streamCSV(stopsPath, (row) => {
    if (!TARGET_STOP_IDS.has(row.stop_id)) return
    rows.push({
      stop_id: row.stop_id,
      stop_name: row.stop_name,
      stop_lat: row.stop_lat ? parseFloat(row.stop_lat) : null,
      stop_lon: row.stop_lon ? parseFloat(row.stop_lon) : null,
    })
  })

  await batchInsert('stops', rows)
}

async function loadRoutes(routesPath: string, routeIds: Set<string>): Promise<void> {
  console.log('\nLoading routes …')
  const rows: Record<string, unknown>[] = []

  await streamCSV(routesPath, (row) => {
    if (!routeIds.has(row.route_id)) return
    rows.push({
      route_id: row.route_id,
      route_short_name: row.route_short_name ?? '',
      route_long_name: row.route_long_name ?? null,
      route_type: row.route_type ? parseInt(row.route_type, 10) : null,
    })
  })

  await batchInsert('routes', rows)
}

async function loadTrips(tripsPath: string, tripIds: Set<string>): Promise<void> {
  console.log('\nLoading trips …')
  const rows: Record<string, unknown>[] = []

  await streamCSV(tripsPath, (row) => {
    if (!tripIds.has(row.trip_id)) return
    rows.push({
      trip_id: row.trip_id,
      route_id: row.route_id,
      service_id: row.service_id,
      trip_headsign: row.trip_headsign ?? null,
      direction_id:
        row.direction_id != null && row.direction_id !== ''
          ? parseInt(row.direction_id, 10)
          : null,
    })
  })

  await batchInsert('trips', rows)
}

async function loadCalendar(
  calendarPath: string,
  serviceIds: Set<string>
): Promise<void> {
  if (!existsSync(calendarPath)) {
    console.log('\nSkipping calendar.txt (not found)')
    return
  }
  console.log('\nLoading calendar …')
  const rows: Record<string, unknown>[] = []

  await streamCSV(calendarPath, (row) => {
    if (!serviceIds.has(row.service_id)) return
    rows.push({
      service_id: row.service_id,
      monday:    row.monday    === '1',
      tuesday:   row.tuesday   === '1',
      wednesday: row.wednesday === '1',
      thursday:  row.thursday  === '1',
      friday:    row.friday    === '1',
      saturday:  row.saturday  === '1',
      sunday:    row.sunday    === '1',
      start_date: formatDate(row.start_date),
      end_date:   formatDate(row.end_date),
    })
  })

  await batchInsert('calendar', rows)
}

async function loadCalendarDates(
  calendarDatesPath: string,
  serviceIds: Set<string>
): Promise<void> {
  if (!existsSync(calendarDatesPath)) {
    console.log('\nSkipping calendar_dates.txt (not found)')
    return
  }
  console.log('\nLoading calendar_dates …')
  const rows: Record<string, unknown>[] = []

  await streamCSV(calendarDatesPath, (row) => {
    if (!serviceIds.has(row.service_id)) return
    rows.push({
      service_id: row.service_id,
      date: formatDate(row.date),
      exception_type: parseInt(row.exception_type, 10),
    })
  })

  // Insert in batches (no simple PK for delete-all on this table)
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('calendar_dates').insert(batch)
    if (error) {
      console.error('[calendar_dates] insert error:', error.message)
      throw error
    }
  }
  console.log(`  ✓ calendar_dates: ${rows.length} rows loaded`)
}

async function loadStopTimes(
  stopTimesPath: string,
  tripIds: Set<string>
): Promise<void> {
  console.log('\nPass 3: loading stop_times for target stops …')
  let batch: Record<string, unknown>[] = []
  let total = 0

  async function flush() {
    if (batch.length === 0) return
    const { error } = await supabase.from('stop_times').insert(batch)
    if (error) {
      console.error('\n[stop_times] insert error:', error.message)
      throw error
    }
    total += batch.length
    process.stdout.write(`  ${total} rows inserted…\r`)
    batch = []
  }

  await streamCSV(stopTimesPath, async (row) => {
    if (!TARGET_STOP_IDS.has(row.stop_id)) return
    if (!tripIds.has(row.trip_id)) return

    batch.push({
      trip_id: row.trip_id,
      stop_id: row.stop_id,
      departure_time: row.departure_time || row.arrival_time,
      stop_sequence: parseInt(row.stop_sequence, 10),
    })

    if (batch.length >= BATCH_SIZE) await flush()
  })

  await flush()
  console.log(`\n  ✓ stop_times: ${total} rows loaded`)
}

// ---- Utility ----------------------------------------------------------------

// Convert GTFS date "YYYYMMDD" → SQL "YYYY-MM-DD"
function formatDate(d: string): string {
  if (!d || d.length !== 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

// ---- Clear existing data (FK-safe order) ------------------------------------

async function clearStaticData(): Promise<void> {
  console.log('\nClearing existing static data …')

  // Each entry: [table, pk_column] — delete all rows by filtering on PK
  // Order: child tables first (FK constraints), then parents
  const tables: [string, string][] = [
    ['stop_times',     'id'],           // bigserial
    ['calendar_dates', 'service_id'],   // text
    ['calendar',       'service_id'],   // text
    ['trips',          'trip_id'],      // text
    ['routes',         'route_id'],     // text
    ['stops',          'stop_id'],      // text
  ]

  for (const [table, pk] of tables) {
    // gte('pk', '') matches every row (every string/number is >= empty string / 0)
    const { error } = await supabase
      .from(table)
      .delete()
      .gte(pk, '')
    if (error) {
      console.warn(`  Warning clearing ${table}: ${error.message}`)
    } else {
      console.log(`  cleared ${table}`)
    }
  }
}

// ---- Main -------------------------------------------------------------------

async function main() {
  console.log('=== Leave Now — GTFS Loader ===')
  console.log(`Target stop IDs: ${[...TARGET_STOP_IDS].join(', ')}`)
  console.log(`Supabase URL: ${SUPABASE_URL}`)

  // Quick connectivity test before downloading anything
  const { data, error: connErr } = await supabase.from('stops').select('stop_id').limit(1)
  if (connErr) {
    console.error('\n❌ Cannot reach Supabase:', connErr.message)
    console.error('   Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local')
    process.exit(1)
  }
  console.log('✓ Supabase connection OK\n')

  mkdirSync(TMP_DIR, { recursive: true })

  const zipPath = join(TMP_DIR, 'gtfs.zip')
  const extractDir = join(TMP_DIR, 'extracted')

  await download(GTFS_ZIP_URL, zipPath)
  unzip(zipPath, extractDir)

  const f = (name: string) => join(extractDir, name)

  // Pass 1: collect trip IDs that serve our stops
  const tripIds = await collectTripIds(f('stop_times.txt'))

  if (tripIds.size === 0) {
    console.error('\n❌ No trips found. Check your TARGET_STOP_IDS values.')
    console.error('   Hint: find stop IDs in the stops.txt file from the GTFS zip.')
    process.exit(1)
  }

  // Pass 2: collect route + service IDs from those trips
  const { routeIds, serviceIds } = await collectRouteAndServiceIds(f('trips.txt'), tripIds)

  // Clear old data
  await clearStaticData()

  // Load in FK-safe order: stops → routes → trips → calendar → calendar_dates
  await loadStops(f('stops.txt'))
  await loadRoutes(f('routes.txt'), routeIds)
  await loadTrips(f('trips.txt'), tripIds)
  await loadCalendar(f('calendar.txt'), serviceIds)
  await loadCalendarDates(f('calendar_dates.txt'), serviceIds)

  // Pass 3: load stop_times
  await loadStopTimes(f('stop_times.txt'), tripIds)

  console.log('\n✅ GTFS load complete!')
  console.log('\nWhat to do next:')
  console.log('  1. Open the Settings page and search for your stops')
  console.log('  2. Set your walking pace')
  console.log(`  3. Stop IDs you loaded: ${[...TARGET_STOP_IDS].join(', ')}`)
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err.message)
  process.exit(1)
})
