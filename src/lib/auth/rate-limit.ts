import { prisma } from '../db'

/**
 * Fixed-window rate limiting.
 *
 * Load-bearing rather than hygiene: every SMS verification attempt costs
 * real money, so an unthrottled signup form is a way to spend someone
 * else's budget. Fixed windows allow a burst at a boundary; that is an
 * accepted trade for not needing Redis.
 */
export type LimitResult = {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export async function consume(
  bucket: string,
  identifier: string,
  opts: { limit: number; windowSeconds: number },
): Promise<LimitResult> {
  const windowMs = opts.windowSeconds * 1000
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs)

  const row = await prisma.rateLimit.upsert({
    where: { bucket_identifier_windowStart: { bucket, identifier, windowStart } },
    create: { bucket, identifier, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  })

  const retryAfter = Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000)
  return {
    ok: row.count <= opts.limit,
    remaining: Math.max(0, opts.limit - row.count),
    retryAfterSeconds: Math.max(0, retryAfter),
  }
}

/** Housekeeping for the cron job; windows older than a day are dead weight. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } },
  })
  return count
}
