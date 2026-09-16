/**
 * Detection regression check.
 *
 * The first-ingest guard must suppress backfill noise without suppressing
 * real transitions afterwards — those two pull in opposite directions and
 * it is easy to fix one by breaking the other.
 *
 * Mutates data. Run against a development database, then reseed.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { syncTitle } from '../src/lib/sync'
import type { EventType } from '../src/generated/prisma/enums'

function countEvents(titleId: string, types: EventType[]) {
  return prisma.releaseEvent.count({ where: { titleId, eventType: { in: types } } })
}

async function main() {
  const title = await prisma.title.findFirstOrThrow({ where: { name: 'Poor Things' } })

  const afterBackfill = await countEvents(title.id, ['ARRIVES_ON_MY_SERVICE', 'STREAMING_DEBUT'])
  console.log('after first ingest (want 0):', afterBackfill)

  // Rewind: pretend we have never seen this title stream anywhere.
  await prisma.availability.deleteMany({ where: { titleId: title.id } })
  await prisma.title.update({ where: { id: title.id }, data: { hasEverStreamed: false } })

  // It now appears on a service. A real transition, not a backfill.
  const transition = await syncTitle(title.tmdbId, title.mediaType, 'US')
  const arrives = await countEvents(title.id, ['ARRIVES_ON_MY_SERVICE'])
  const debut = await countEvents(title.id, ['STREAMING_DEBUT'])
  console.log('real transition — arrivals (want >=1):', arrives)
  console.log('real transition — debut    (want  1):', debut)

  // Running the same sync again must not duplicate anything.
  const repeat = await syncTitle(title.tmdbId, title.mediaType, 'US')
  console.log('re-sync emitted (want 0):', repeat.events)

  const ok =
    afterBackfill === 0 && arrives >= 1 && debut === 1 && transition.events > 0 && repeat.events === 0

  console.log(ok ? '\nPASS' : '\nFAIL')
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
