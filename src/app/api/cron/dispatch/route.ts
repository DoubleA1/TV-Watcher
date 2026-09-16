import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron-auth'
import { dispatchDue } from '@/lib/notify/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Delivery. Sends every notification whose scheduled moment has arrived.
 *
 * Wants to run often — a premiere scheduled to the second is only as
 * precise as the gap between these runs.
 */
export async function POST(request: Request) {
  const auth = authorizeCron(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  const started = Date.now()
  const stats = await dispatchDue(100)

  return NextResponse.json({ ok: true, durationMs: Date.now() - started, ...stats })
}
