import { NextRequest, NextResponse } from 'next/server'
import { broadcastPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await broadcastPush({
    title: 'Leave now!',
    body: 'Test notification — catch the 46A at 12:00 — Test Stop',
    tag: `test-${Date.now()}`,
    timestamp: Date.now(),
  })

  return NextResponse.json({ ok: true })
}
