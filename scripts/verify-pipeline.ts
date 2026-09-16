/**
 * End-to-end pipeline check: detection → fan-out → delivery.
 *
 * Drives the same functions the cron endpoints call, so a pass here means
 * the scheduled jobs would do the right thing. Mutates data; run against a
 * development database.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { fanOutEvents, dispatchDue, applyQuietHours } from '../src/lib/notify/dispatch'

async function main() {
  // Reset delivery state so the script is re-runnable. Without this a second
  // run has nothing left to fan out and fails on its own success.
  await prisma.notification.deleteMany({})
  await prisma.releaseEvent.updateMany({ data: { fannedOutAt: null } })

  // Quiet hours: 23:00–07:00 in New York. A 02:00 drop must be held to 07:00.
  const midnightDrop = new Date('2026-10-02T06:00:00Z') // 02:00 EDT
  const held = applyQuietHours(midnightDrop, 'America/New_York', 1380, 420)
  const heldHour = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', hour12: false, timeZone: 'America/New_York',
  }).format(held)
  console.log(`quiet hours: 02:00 drop held until ${heldHour}:00 local`)

  // A midday drop must not be moved at all.
  const middayDrop = new Date('2026-10-02T18:00:00Z') // 14:00 EDT
  const untouched = applyQuietHours(middayDrop, 'America/New_York', 1380, 420)
  console.log(`quiet hours: midday drop moved: ${untouched.getTime() !== middayDrop.getTime()}`)

  const fan = await fanOutEvents(500)
  console.log(`fan-out: ${fan.events} events -> ${fan.notifications} notifications`)

  // Re-running must not duplicate.
  const again = await fanOutEvents(500)
  console.log(`fan-out again (want 0/0): ${again.events} events, ${again.notifications} notifications`)

  // Pull anything scheduled in the future forward so delivery has work.
  await prisma.notification.updateMany({
    where: { status: 'PENDING' },
    data: { scheduledFor: new Date(Date.now() - 1000) },
  })

  const sent = await dispatchDue(5)
  console.log(`dispatch: sent ${sent.sent}, failed ${sent.failed}, suppressed ${sent.suppressed}`)

  const statuses = await prisma.notification.groupBy({
    by: ['status', 'channel'],
    _count: { status: true },
  })
  console.log('notification states:', statuses.map((s) => `${s.channel}/${s.status}=${s._count.status}`).join(' '))

  const ok =
    heldHour === '07' &&
    untouched.getTime() === middayDrop.getTime() &&
    fan.notifications > 0 &&
    again.notifications === 0 &&
    sent.sent > 0

  console.log(ok ? '\nPASS' : '\nFAIL')
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
