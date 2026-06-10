import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calcWalkMinutes } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// GET /api/user-stops — list all configured stops with stop name joined
export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('user_stops')
    .select(`
      id, stop_id, walk_minutes, walk_minutes_override, label,
      stops ( stop_name, stop_lat, stop_lon )
    `)
    .order('id')

  if (error) {
    console.error('[api/user-stops GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 })
  }

  // Flatten the join for easier consumption
  const result = (data ?? []).map((row) => ({
    id: row.id,
    stop_id: row.stop_id,
    walk_minutes: row.walk_minutes,
    walk_minutes_override: row.walk_minutes_override,
    label: row.label,
    stop_name: (row.stops as any)?.stop_name ?? null,
    stop_lat: (row.stops as any)?.stop_lat ?? null,
    stop_lon: (row.stops as any)?.stop_lon ?? null,
  }))

  return NextResponse.json(result)
}

// POST /api/user-stops — add a stop
// Body: { stop_id: string, label?: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.stop_id) {
    return NextResponse.json({ error: 'stop_id is required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Fetch stop details + current user settings to auto-calc walk_minutes
  const [{ data: stop }, { data: settings }] = await Promise.all([
    supabase
      .from('stops')
      .select('stop_lat, stop_lon')
      .eq('stop_id', body.stop_id)
      .single(),
    supabase
      .from('user_settings')
      .select('walk_pace_min_per_km, origin_lat, origin_lon')
      .eq('id', 1)
      .single(),
  ])

  let walkMinutes: number | null = null
  if (
    stop?.stop_lat != null &&
    stop?.stop_lon != null &&
    settings?.origin_lat != null &&
    settings?.origin_lon != null
  ) {
    walkMinutes = calcWalkMinutes(
      stop.stop_lat,
      stop.stop_lon,
      settings.origin_lat,
      settings.origin_lon,
      settings.walk_pace_min_per_km
    )
  }

  const { data, error } = await supabase
    .from('user_stops')
    .insert({
      stop_id: body.stop_id,
      label: body.label ?? null,
      walk_minutes: walkMinutes,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Stop already added' },
        { status: 409 }
      )
    }
    console.error('[api/user-stops POST]', error.message)
    return NextResponse.json({ error: 'Failed to add stop' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/user-stops?id=1 — update walk_minutes_override or label
// Body: { walk_minutes_override?: number | null, label?: string | null }
export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if ('walk_minutes_override' in body) {
    updates.walk_minutes_override = body.walk_minutes_override
  }
  if ('label' in body) {
    updates.label = body.label
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('user_stops')
    .update(updates)
    .eq('id', parseInt(id, 10))
    .select()
    .single()

  if (error) {
    console.error('[api/user-stops PATCH]', error.message)
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/user-stops?id=1 — remove a stop
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('user_stops')
    .delete()
    .eq('id', parseInt(id, 10))

  if (error) {
    console.error('[api/user-stops DELETE]', error.message)
    return NextResponse.json({ error: 'Failed to delete stop' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
