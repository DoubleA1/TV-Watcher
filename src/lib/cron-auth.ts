import { timingSafeEqual } from 'node:crypto'

/**
 * Shared-secret guard for the scheduled endpoints.
 *
 * These routes cost upstream API quota and send real messages, so they must
 * not be publicly callable. Compared in constant time so the check does not
 * leak the secret one byte at a time.
 */
export function authorizeCron(request: Request): { ok: boolean; reason?: string } {
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) {
    // Refuse rather than default open: an unset secret in production would
    // otherwise silently expose the endpoint.
    return { ok: false, reason: 'CRON_SECRET is not configured' }
  }

  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return { ok: false, reason: 'Unauthorized' }
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'Unauthorized' }

  return { ok: true }
}
