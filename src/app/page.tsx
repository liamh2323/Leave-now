import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import DepartureList from '@/components/DepartureList'

export const dynamic = 'force-dynamic'

// Fetch user stops server-side so the initial render has data
async function getUserStops() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('user_stops')
      .select(`
        id, stop_id, walk_minutes, walk_minutes_override, label,
        stops ( stop_name, stop_lat, stop_lon )
      `)
      .order('id')
    return (data ?? []).map((row: any) => ({
      id: row.id,
      stop_id: row.stop_id,
      walk_minutes: row.walk_minutes,
      walk_minutes_override: row.walk_minutes_override,
      label: row.label,
      stop_name: row.stops?.stop_name ?? null,
      stop_lat: row.stops?.stop_lat ?? null,
      stop_lon: row.stops?.stop_lon ?? null,
    }))
  } catch {
    return []
  }
}

export default async function HomePage() {
  const userStops = await getUserStops()

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Now</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-IE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <Link
          href="/settings"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>

      {/* No stops configured */}
      {userStops.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <div className="text-5xl">🚌</div>
          <h2 className="text-lg font-semibold">No stops added yet</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Add your bus stops and walking time in Settings to see upcoming departures.
          </p>
          <Link
            href="/settings"
            className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            Open Settings
          </Link>
        </div>
      )}

      {/* Departures per stop */}
      {userStops.map((userStop) => (
        <section key={userStop.stop_id} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-300">
              {userStop.label ?? userStop.stop_name ?? userStop.stop_id}
            </h2>
            {userStop.label && (
              <span className="text-xs text-slate-500">
                {userStop.stop_name ?? userStop.stop_id}
              </span>
            )}
          </div>

          <DepartureList userStop={userStop} />
        </section>
      ))}
    </main>
  )
}
