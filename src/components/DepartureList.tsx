'use client'

import DepartureCard from './DepartureCard'
import { useDepartures } from '@/hooks/useDepartures'
import { effectiveWalkMinutes } from '@/lib/walk'
import type { UserStop } from '@/types/gtfs'

interface DepartureListProps {
  userStop: UserStop
}

export default function DepartureList({ userStop }: DepartureListProps) {
  const walkMinutes = effectiveWalkMinutes(
    userStop.walk_minutes_override,
    userStop.walk_minutes
  )

  const { departures, isLoading, error } = useDepartures(
    userStop.stop_id,
    walkMinutes,
    3
  )

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-400 py-2">
        Failed to load departures. Check your connection.
      </p>
    )
  }

  if (departures.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-2">
        No upcoming buses found. Check the schedule or your stop ID.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {departures.map((dep) => (
        <DepartureCard
          key={`${dep.tripId}-${dep.scheduledSeconds}`}
          departure={dep}
          walkMinutes={walkMinutes}
        />
      ))}
    </div>
  )
}
