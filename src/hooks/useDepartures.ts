'use client'

import useSWR from 'swr'
import type { Departure } from '@/types/gtfs'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface UseDeparturesResult {
  departures: Departure[]
  isLoading: boolean
  error: unknown
}

export function useDepartures(
  stopId: string | null,
  walkMinutes: number,
  limit = 5
): UseDeparturesResult {
  const url = stopId
    ? `/api/departures?stopId=${stopId}&walkMinutes=${walkMinutes}&limit=${limit}`
    : null

  const { data, isLoading, error } = useSWR<Departure[]>(url, fetcher, {
    refreshInterval: 30_000,  // re-poll every 30 seconds
    revalidateOnFocus: true,
  })

  return {
    departures: data ?? [],
    isLoading,
    error,
  }
}
