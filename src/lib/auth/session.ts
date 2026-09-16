import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '../db'

const COOKIE = 'tvw_session'
const TTL_DAYS = 30

/**
 * Only the hash of the cookie value is stored. A database leak then yields
 * no usable sessions, the same reasoning that applies to passwords.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type SessionUser = {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
  timezone: string
  region: string
  smsEnabled: boolean
  emailEnabled: boolean
  phoneVerifiedAt: Date | null
}

/**
 * Issue a session and set the cookie.
 * Only callable from a Server Action or Route Handler — Next cannot set
 * cookies during Server Component rendering.
 */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000)

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  })

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

/** The signed-in user, or null. Safe to call from Server Components. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          displayName: true,
          timezone: true,
          region: true,
          smsEnabled: true,
          emailEnabled: true,
          phoneVerifiedAt: true,
        },
      },
    },
  })

  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  return session.user
}

/** Sign out. Server Action or Route Handler only. */
export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(COOKIE)
}
