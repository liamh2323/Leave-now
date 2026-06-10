import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingDepartures } from '@/lib/gtfs-static'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const stopId = searchParams.get('stopId')
  const walkMinutes = parseFloat(searchParams.get('walkMinutes') ?? '10')
  const limit = parseInt(searchParams.get('limit') ?? '5', 10)

  if (!stopId) {
    return NextResponse.json(
      { error: 'stopId is required' },
      { status: 400 }
    )
  }

  try {
    const departures = await getUpcomingDepartures(stopId, walkMinutes, limit)
    return NextResponse.json(departures, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[api/departures]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
