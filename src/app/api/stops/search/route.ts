import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/stops/search?q=dame+street
// Searches stops that have been loaded into Supabase (your filtered subset).
// Returns up to 10 matching stops.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('stops')
    .select('stop_id, stop_name, stop_lat, stop_lon')
    .ilike('stop_name', `%${q}%`)
    .order('stop_name')
    .limit(10)

  if (error) {
    console.error('[api/stops/search]', error.message)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
