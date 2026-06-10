'use client'

import { useEffect, useState } from 'react'
import { formatDublinTime } from '@/lib/time'
import type { Departure } from '@/types/gtfs'

interface DepartureCardProps {
  departure: Departure
  walkMinutes: number
}

export default function DepartureCard({ departure, walkMinutes }: DepartureCardProps) {
  // Re-render every 10 seconds to keep "leave in X min" live
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  const leaveInMs = new Date(departure.leaveByTime).getTime() - Date.now()
  const leaveInMin = leaveInMs / 60_000
  const departureStr = formatDublinTime(new Date(departure.actualDepartureTime))

  const isUrgent = leaveInMin <= 2 && leaveInMin > -1
  const isMissed = leaveInMin < -1

  let leaveLabel: string
  if (isMissed) {
    leaveLabel = 'Left already'
  } else if (leaveInMin <= 0) {
    leaveLabel = 'Leave now!'
  } else if (leaveInMin < 1) {
    leaveLabel = 'Leave in < 1 min'
  } else {
    leaveLabel = `Leave in ${Math.round(leaveInMin)} min`
  }

  const hasDelay = Math.abs(departure.delaySeconds) > 60
  const delayMin = Math.round(departure.delaySeconds / 60)

  return (
    <div
      className={[
        'rounded-xl p-4 transition-colors',
        isMissed
          ? 'bg-slate-800 opacity-50'
          : isUrgent
            ? 'bg-blue-900 ring-2 ring-blue-500'
            : 'bg-slate-800',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Route + headsign */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 bg-blue-600 text-white text-sm font-bold px-2 py-0.5 rounded">
            {departure.routeShortName}
          </span>
          <span className="text-sm text-slate-300 truncate">{departure.tripHeadsign}</span>
        </div>

        {/* Departure time */}
        <div className="flex-shrink-0 text-right">
          <span className="text-lg font-semibold tabular-nums">{departureStr}</span>
          {hasDelay && (
            <span
              className={[
                'block text-xs',
                delayMin > 0 ? 'text-amber-400' : 'text-green-400',
              ].join(' ')}
            >
              {delayMin > 0 ? `+${delayMin}` : delayMin} min
            </span>
          )}
        </div>
      </div>

      {/* Leave-by banner */}
      <div className="mt-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span
          className={[
            'text-sm font-medium',
            isMissed
              ? 'text-slate-500'
              : isUrgent
                ? 'text-blue-200'
                : 'text-slate-300',
          ].join(' ')}
        >
          {leaveLabel}
        </span>
        <span className="text-xs text-slate-500 ml-auto">{walkMinutes} min walk</span>
      </div>
    </div>
  )
}
