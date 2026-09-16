'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import type { RatingValue } from '@/generated/prisma/enums'

export async function rateTitle(titleId: string, value: RatingValue): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  await prisma.rating.upsert({
    where: { userId_titleId: { userId: user.id, titleId } },
    create: { userId: user.id, titleId, value },
    update: { value },
  })

  revalidatePath('/taste')
}

export async function resetRatings(): Promise<void> {
  const user = await getSessionUser()
  if (!user) return
  await prisma.rating.deleteMany({ where: { userId: user.id } })
  revalidatePath('/taste')
}
