import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron-auth'
import { syncDueTitles } from '@/lib/sync'
import { fanOutEvents } from '@/lib/notify/dispatch'
import { pruneRateLimits } from '@/lib/auth/rate-limit'

// Polls upstream, so it must never be prerendered or cached.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * The poller. Refresh whatever is due, then turn anything newly detected
 * into per-user notifications.
 *
 * Runs on any scheduler that can make an authenticated request — Vercel
 * Cron, GitHub Actions, a system crontab. Nothing here is host-specific.
 */
export async function POST(request: Request) {
  const auth = authorizeCron(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  const started = Date.now()
  const sync = await syncDueTitles(25)
  const fanOut = await fanOutEvents(200)
  const pruned = await pruneRateLimits()

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    sync,
    fanOut,
    rateLimitRowsPruned: pruned,
  })
}
