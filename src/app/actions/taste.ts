'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { getEntitlement } from '@/lib/taste'
import type { RatingValue } from '@/generated/prisma/enums'

export async function rateTitle(titleId: string, value: RatingValue): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  // "Not seen" costs nothing: it teaches us nothing about taste, so charging
  // it against the free allowance would be charging for our own bad guess.
  if (value !== 'NOT_SEEN') {
    const entitlement = await getEntitlement(user.id)
    if (entitlement.locked) return
  }

  await prisma.rating.upsert({
    where: { userId_titleId: { userId: user.id, titleId } },
    create: { userId: user.id, titleId, value },
    update: { value },
  })

  revalidatePath('/taste')
}

/** "I have seen that already" — swap the suggestion for another. */
export async function dismissSuggestion(titleId: string): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  await prisma.suggestion.updateMany({
    where: { userId: user.id, titleId },
    data: { dismissedAt: new Date() },
  })

  revalidatePath('/taste')
}

export async function resetRatings(): Promise<void> {
  const user = await getSessionUser()
  if (!user) return
  await prisma.rating.deleteMany({ where: { userId: user.id } })
  await prisma.suggestion.deleteMany({ where: { userId: user.id } })
  revalidatePath('/taste')
}
