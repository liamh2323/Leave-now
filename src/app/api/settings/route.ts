import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calcWalkMinutes } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// GET /api/settings — fetch user_settings row
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('[api/settings GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// PUT /api/settings — update walk_pace_min_per_km and/or origin coords
// Body: { walk_pace_min_per_km?: number, origin_lat?: number | null, origin_lon?: number | null }
// When pace or origin changes, recalculates walk_minutes for all stops
// that don't have a manual override (walk_minutes_override IS NULL).
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  if ('walk_pace_min_per_km' in body) {
    const pace = parseFloat(body.walk_pace_min_per_km)
    if (isNaN(pace) || pace < 1 || pace > 60) {
      return NextResponse.json(
        { error: 'walk_pace_min_per_km must be between 1 and 60' },
        { status: 400 }
      )
    }
    updates.walk_pace_min_per_km = pace
  }
  if ('origin_lat' in body) updates.origin_lat = body.origin_lat
  if ('origin_lon' in body) updates.origin_lon = body.origin_lon

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Fetch current settings to merge with updates
  const { data: current } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', 1)
    .single()

  const merged = { ...current, ...updates }

  const { data: saved, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    console.error('[api/settings PUT]', error.message)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  // Recalculate walk_minutes for stops without a manual override
  if (merged.origin_lat != null && merged.origin_lon != null) {
    const { data: userStops } = await supabase
      .from('user_stops')
      .select('id, stop_id, walk_minutes_override, stops(stop_lat, stop_lon)')
      .is('walk_minutes_override', null)

    if (userStops && userStops.length > 0) {
      await Promise.all(
        userStops.map(async (us) => {
          const stop = us.stops as any
          if (stop?.stop_lat == null || stop?.stop_lon == null) return
          const minutes = calcWalkMinutes(
            stop.stop_lat,
            stop.stop_lon,
            merged.origin_lat,
            merged.origin_lon,
            merged.walk_pace_min_per_km
          )
          await supabase
            .from('user_stops')
            .update({ walk_minutes: minutes })
            .eq('id', us.id)
        })
      )
    }
  }

  return NextResponse.json(saved)
}
