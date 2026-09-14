/**
 * Exercises the parts of the model that are easy to get wrong: the five
 * independent alert rules, the offer-type array default, global event dedupe,
 * and per-user notification dedupe.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { EventType } from '../src/generated/prisma/enums'

async function main() {
  // Clean slate so the script is re-runnable.
  await prisma.user.deleteMany({ where: { email: 'smoke@example.com' } })
  await prisma.title.deleteMany({ where: { tmdbId: -1 } })

  const user = await prisma.user.create({
    data: {
      email: 'smoke@example.com',
      displayName: 'Smoke Test',
      timezone: 'America/New_York',
    },
  })

  const title = await prisma.title.create({
    data: { tmdbId: -1, mediaType: 'TV', name: 'Fixture Show' },
  })

  // Follow with all five alert types wired up independently.
  const follow = await prisma.follow.create({
    data: {
      userId: user.id,
      titleId: title.id,
      alerts: {
        create: Object.values(EventType).map((eventType) => ({
          eventType,
          // Episode-level alerts are opt-in; everything else defaults on.
          enabled: eventType !== EventType.NEW_EPISODE,
        })),
      },
    },
    include: { alerts: true },
  })

  console.log('offerTypes default     :', follow.offerTypes)
  console.log('anyService default     :', follow.anyService)
  console.log('alert rules created    :', follow.alerts.length)
  console.log(
    'enabled by default     :',
    follow.alerts.filter((a) => a.enabled).map((a) => a.eventType).sort().join(', '),
  )
  console.log(
    'opt-in only            :',
    follow.alerts.filter((a) => !a.enabled).map((a) => a.eventType).join(', '),
  )

  // Global dedupe: the same real-world event must only ever exist once,
  // however many times a flaky upstream API reports it.
  const dedupeKey = `SEASON_PREMIERE:${title.id}:s2`
  const eventData = {
    titleId: title.id,
    eventType: EventType.SEASON_PREMIERE,
    dedupeKey,
    occursAt: new Date(Date.now() + 86_400_000),
    payload: { seasonNumber: 2 },
  }
  const event = await prisma.releaseEvent.create({ data: eventData })
  let duplicateRejected = false
  try {
    await prisma.releaseEvent.create({ data: eventData })
  } catch {
    duplicateRejected = true
  }
  console.log('duplicate event blocked:', duplicateRejected)

  // Per-user, per-channel delivery dedupe.
  const notifData = {
    userId: user.id,
    releaseEventId: event.id,
    channel: 'EMAIL' as const,
    scheduledFor: event.occursAt,
    body: 'Fixture Show season 2 drops tomorrow.',
  }
  await prisma.notification.create({ data: notifData })
  let duplicateNotifRejected = false
  try {
    await prisma.notification.create({ data: notifData })
  } catch {
    duplicateNotifRejected = true
  }
  console.log('duplicate notif blocked:', duplicateNotifRejected)

  // Same event on a different channel is legitimate and must be allowed.
  await prisma.notification.create({ data: { ...notifData, channel: 'SMS' } })
  const channels = await prisma.notification.count({
    where: { releaseEventId: event.id },
  })
  console.log('notifs across channels :', channels)

  const ok =
    follow.alerts.length === 5 &&
    duplicateRejected &&
    duplicateNotifRejected &&
    channels === 2 &&
    follow.offerTypes.length === 1 &&
    follow.offerTypes[0] === 'FLATRATE'

  console.log(ok ? '\nPASS' : '\nFAIL')
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
