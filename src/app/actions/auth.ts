'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { normalizePhone } from '@/lib/auth/phone'
import { consume } from '@/lib/auth/rate-limit'
import { createSession, destroySession, getSessionUser } from '@/lib/auth/session'

export type FormState = { error?: string; ok?: boolean }

const credentials = z.object({
  email: z.string().email('That does not look like an email address'),
  password: z.string().min(12, 'Use at least 12 characters'),
})

async function clientMeta() {
  const h = await headers()
  return {
    userAgent: h.get('user-agent'),
    // Behind a proxy the first hop is the real client.
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  }
}

export async function signUpWithEmail(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check those details' }
  }

  const meta = await clientMeta()
  const limit = await consume('signup', meta.ipAddress ?? 'unknown', {
    limit: 5,
    windowSeconds: 3600,
  })
  if (!limit.ok) {
    return { error: 'Too many attempts. Try again in a little while.' }
  }

  const email = parsed.data.email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return { error: 'There is already an account with that email. Try signing in.' }
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(parsed.data.password),
      emailEnabled: true,
    },
  })

  await createSession(user.id, meta)
  redirect('/onboarding')
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').toLowerCase().trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password' }

  const meta = await clientMeta()
  const limit = await consume('signin', `${meta.ipAddress ?? 'unknown'}:${email}`, {
    limit: 10,
    windowSeconds: 900,
  })
  if (!limit.ok) return { error: 'Too many attempts. Try again in a few minutes.' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })

  // Same message either way: distinguishing them tells an attacker which
  // addresses have accounts.
  const failure = { error: 'That email and password do not match' }
  if (!user?.passwordHash) return failure
  if (!(await verifyPassword(password, user.passwordHash))) return failure

  await createSession(user.id, meta)
  redirect('/queue')
}

/**
 * Phone signup.
 *
 * The verification code cannot actually be delivered until A2P 10DLC
 * registration clears, so this records intent and hands back the honest
 * state rather than pretending a text went out.
 */
export async function startPhoneSignUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = String(formData.get('phone') ?? '')
  const phone = normalizePhone(raw)
  if (!phone) return { error: 'That does not look like a mobile number' }

  const meta = await clientMeta()
  const limit = await consume('phone-code', phone, { limit: 3, windowSeconds: 3600 })
  if (!limit.ok) {
    return { error: 'Too many codes requested for that number. Try again later.' }
  }

  return {
    error:
      'Phone sign-up is not switched on yet — carrier registration is still pending. Use email for now and add your number once it clears.',
  }
}

/**
 * Attach a phone number to an existing account.
 *
 * Stored unverified: nothing is ever texted to a number that has not
 * confirmed a code, because consent is per-number and A2P compliance
 * depends on it.
 */
export async function addPhoneNumber(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser()
  if (!user) return { error: 'Sign in first' }

  const phone = normalizePhone(String(formData.get('phone') ?? ''))
  if (!phone) return { error: 'That does not look like a mobile number' }

  const taken = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (taken && taken.id !== user.id) {
    return { error: 'That number is already on another account' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { phone, phoneVerifiedAt: null },
  })

  revalidatePath('/onboarding')
  revalidatePath('/settings')
  return { ok: true }
}

export async function signOut(): Promise<void> {
  await destroySession()
  revalidatePath('/')
  redirect('/')
}

/** Sign into the seeded demo account. Development only. */
export async function signInAsDemo(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo sign-in is disabled in production')
  }
  const user = await prisma.user.findUnique({
    where: { email: 'demo@tvwatcher.local' },
    select: { id: true },
  })
  if (!user) throw new Error('Demo account not seeded — run npm run db:seed')

  await createSession(user.id, await clientMeta())
  redirect('/queue')
}
