/**
 * Fan-out and delivery.
 *
 * Fan-out turns one world fact (a ReleaseEvent) into per-user Notification
 * rows, applying each user's alert rules, offer-type preferences and service
 * list. Delivery then sends whatever is due. Keeping them apart means a
 * failed send retries without re-deriving who should get it, and the unique
 * index on (user, event, channel) makes both halves idempotent.
 */
import { prisma } from '../db'
import { emailChannel, smsChannel, type Channel } from './channels'
import { renderMessage, type EventPayload } from './render'
import type { NotificationChannel } from '@/generated/prisma/enums'

const MAX_ATTEMPTS = 4

/**
 * Push a send out of the user's quiet hours.
 *
 * A Netflix title dropping at midnight Pacific is 3am on the east coast,
 * and a text that wakes someone up is a text they turn off. Windows can
 * wrap midnight, which is the case worth getting right.
 */
export function applyQuietHours(
  when: Date,
  timezone: string,
  startMinute: number | null,
  endMinute: number | null,
): Date {
  if (startMinute === null || endMinute === null) return when

  const local = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(when)

  const hour = Number(local.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(local.find((p) => p.type === 'minute')?.value ?? '0')
  const nowMinutes = hour * 60 + minute

  const wraps = startMinute > endMinute
  const inQuiet = wraps
    ? nowMinutes >= startMinute || nowMinutes < endMinute
    : nowMinutes >= startMinute && nowMinutes < endMinute

  if (!inQuiet) return when

  // Hold until the window opens.
  let deltaMinutes = endMinute - nowMinutes
  if (deltaMinutes <= 0) deltaMinutes += 24 * 60
  return new Date(when.getTime() + deltaMinutes * 60_000)
}

export type FanOutStats = { events: number; notifications: number }

export async function fanOutEvents(limit = 200): Promise<FanOutStats> {
  const stats: FanOutStats = { events: 0, notifications: 0 }

  const events = await prisma.releaseEvent.findMany({
    where: { fannedOutAt: null },
    orderBy: { detectedAt: 'asc' },
    take: limit,
    select: {
      id: true,
      titleId: true,
      eventType: true,
      occursAt: true,
      payload: true,
      title: { select: { name: true } },
    },
  })

  for (const event of events) {
    const payload = (event.payload ?? {}) as EventPayload

    const follows = await prisma.follow.findMany({
      where: {
        titleId: event.titleId,
        alerts: { some: { eventType: event.eventType, enabled: true } },
      },
      select: {
        offerTypes: true,
        anyService: true,
        user: {
          select: {
            id: true, email: true, phone: true, timezone: true,
            emailEnabled: true, smsEnabled: true,
            phoneVerifiedAt: true,
            quietHoursStart: true, quietHoursEnd: true,
            services: { select: { provider: { select: { name: true } } } },
          },
        },
      },
    })

    for (const follow of follows) {
      const user = follow.user

      // Availability events carry an offer type and a provider; both have to
      // pass this user's filters or the alert is noise.
      const isAvailability =
        event.eventType === 'ARRIVES_ON_MY_SERVICE' || event.eventType === 'STREAMING_DEBUT'

      if (isAvailability) {
        if (payload.offerType && !follow.offerTypes.includes(payload.offerType)) continue

        if (!follow.anyService && payload.providerName) {
          const subscribed = user.services.some((s) => s.provider.name === payload.providerName)
          if (!subscribed) continue
        }
      }

      const message = renderMessage(event.eventType, payload, event.title.name)

      const channels: Array<{ kind: NotificationChannel; to: string | null }> = [
        { kind: 'EMAIL', to: user.emailEnabled ? user.email : null },
        // Never text an unverified number: consent is per-number, not
        // per-account, and A2P compliance depends on it.
        { kind: 'SMS', to: user.smsEnabled && user.phoneVerifiedAt ? user.phone : null },
      ]

      for (const channel of channels) {
        if (!channel.to) continue

        const scheduledFor = applyQuietHours(
          event.occursAt,
          user.timezone,
          user.quietHoursStart,
          user.quietHoursEnd,
        )

        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              releaseEventId: event.id,
              channel: channel.kind,
              scheduledFor,
              body: channel.kind === 'SMS' ? message.short : message.subject,
            },
          })
          stats.notifications++
        } catch {
          // Unique (user, event, channel) — already queued.
        }
      }
    }

    await prisma.releaseEvent.update({
      where: { id: event.id },
      data: { fannedOutAt: new Date() },
    })
    stats.events++
  }

  return stats
}

export type DispatchStats = {
  sent: number
  failed: number
  suppressed: number
}

export async function dispatchDue(limit = 100): Promise<DispatchStats> {
  const stats: DispatchStats = { sent: 0, failed: 0, suppressed: 0 }

  const due = await prisma.notification.findMany({
    where: {
      status: { in: ['PENDING', 'SCHEDULED'] },
      scheduledFor: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
    select: {
      id: true, channel: true, body: true, attempts: true,
      user: { select: { email: true, phone: true } },
      releaseEvent: {
        select: { eventType: true, payload: true, title: { select: { name: true } } },
      },
    },
  })

  const channels: Record<string, Channel> = {
    EMAIL: emailChannel(),
    SMS: smsChannel(),
  }

  for (const notification of due) {
    const channel = channels[notification.channel]
    const to =
      notification.channel === 'SMS' ? notification.user.phone : notification.user.email

    if (!channel || !to) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SUPPRESSED', failureReason: 'No destination for channel' },
      })
      stats.suppressed++
      continue
    }

    if (!channel.enabled) {
      // Not a failure: the channel is deliberately dark (carrier
      // registration pending), and email already carried the message.
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SUPPRESSED', failureReason: channel.reason ?? 'Channel disabled' },
      })
      stats.suppressed++
      continue
    }

    const payload = (notification.releaseEvent.payload ?? {}) as EventPayload
    const message = renderMessage(
      notification.releaseEvent.eventType,
      payload,
      notification.releaseEvent.title.name,
    )

    const result = await channel.send({
      to,
      subject: message.subject,
      body: message.short,
    })

    if (result.ok) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempts: { increment: 1 },
          providerMessageId: result.providerMessageId ?? null,
          failureReason: null,
        },
      })
      stats.sent++
    } else {
      const attempts = notification.attempts + 1
      const exhausted = !result.retryable || attempts >= MAX_ATTEMPTS
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          failureReason: result.error.slice(0, 500),
        },
      })
      stats.failed++
    }
  }

  return stats
}
