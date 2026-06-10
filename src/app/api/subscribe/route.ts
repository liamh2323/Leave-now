import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/subscribe
// Body: { endpoint: string, keys: { p256dh: string, auth: string }, label?: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json(
      { error: 'endpoint, keys.p256dh, and keys.auth are required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_label: body.label ?? null,
      },
      { onConflict: 'endpoint' }
    )
    .select()
    .single()

  if (error) {
    console.error('[api/subscribe]', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
