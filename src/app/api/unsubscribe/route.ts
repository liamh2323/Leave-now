import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/unsubscribe
// Body: { endpoint: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body?.endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)

  if (error) {
    console.error('[api/unsubscribe]', error.message)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
