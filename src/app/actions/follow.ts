'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { EventType, type OfferType } from '@/generated/prisma/enums'

const DEFAULT_ALERTS = Object.values(EventType).map((eventType) => ({
  eventType,
  // Episode-level alerts are opt-in; everything else is on.
  enabled: eventType !== EventType.NEW_EPISODE,
}))

export async function toggleFollow(titleId: string): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  const existing = await prisma.follow.findUnique({
    where: { userId_titleId: { userId: user.id, titleId } },
    select: { id: true },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
  } else {
    await prisma.follow.create({
      data: { userId: user.id, titleId, alerts: { create: DEFAULT_ALERTS } },
    })
    // A newly followed title should be checked soon rather than whenever
    // its old cadence happened to land.
    await prisma.title.update({
      where: { id: titleId },
      data: { nextRefreshAt: new Date() },
    })
  }

  revalidatePath(`/title/${titleId}`)
  revalidatePath('/queue')
}

export async function setAlert(
  titleId: string,
  eventType: EventType,
  enabled: boolean,
): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  const follow = await prisma.follow.findUnique({
    where: { userId_titleId: { userId: user.id, titleId } },
    select: { id: true },
  })
  if (!follow) return

  await prisma.alertRule.upsert({
    where: { followId_eventType: { followId: follow.id, eventType } },
    create: { followId: follow.id, eventType, enabled },
    update: { enabled },
  })

  revalidatePath(`/title/${titleId}`)
  revalidatePath('/queue')
}

export async function setOfferTypes(titleId: string, offerTypes: OfferType[]): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  await prisma.follow.updateMany({
    where: { userId: user.id, titleId },
    data: { offerTypes },
  })
  revalidatePath(`/title/${titleId}`)
}

export async function toggleService(providerId: string): Promise<void> {
  const user = await getSessionUser()
  if (!user) return

  const existing = await prisma.userService.findUnique({
    where: { userId_providerId: { userId: user.id, providerId } },
    select: { id: true },
  })

  if (existing) {
    await prisma.userService.delete({ where: { id: existing.id } })
  } else {
    await prisma.userService.create({ data: { userId: user.id, providerId } })
  }

  revalidatePath('/settings')
  revalidatePath('/queue')
}
