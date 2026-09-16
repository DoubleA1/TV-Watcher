/**
 * Detection regression check.
 *
 * The first-ingest guard must suppress backfill noise without suppressing
 * real transitions afterwards — those two pull in opposite directions and it
 * is easy to fix one by breaking the other.
 *
 * Self-contained: it deletes the title it tests and re-ingests from scratch,
 * so a genuine first ingest is what gets asserted rather than whatever an
 * earlier run happened to leave behind.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { syncTitle } from '../src/lib/sync'
import type { EventType, MediaType } from '../src/generated/prisma/enums'

const SUBJECT = 'Poor Things'

function countEvents(titleId: string, types: EventType[]) {
  return prisma.releaseEvent.count({ where: { titleId, eventType: { in: types } } })
}

async function main() {
  const seeded = await prisma.title.findFirstOrThrow({ where: { name: SUBJECT } })
  const tmdbId = seeded.tmdbId
  const mediaType: MediaType = seeded.mediaType

  // Wipe it completely; events and availability cascade with the title.
  await prisma.title.delete({ where: { id: seeded.id } })

  // --- a genuine first ingest ---------------------------------------------
  const first = await syncTitle(tmdbId, mediaType, 'US')
  if (!first.titleId) throw new Error('first ingest produced no title')
  const afterBackfill = await countEvents(first.titleId, [
    'ARRIVES_ON_MY_SERVICE',
    'STREAMING_DEBUT',
  ])
  console.log('after first ingest (want 0):', afterBackfill)

  // --- a real transition ---------------------------------------------------
  // Rewind: pretend we have never seen it stream anywhere.
  await prisma.availability.deleteMany({ where: { titleId: first.titleId } })
  await prisma.title.update({ where: { id: first.titleId }, data: { hasEverStreamed: false } })

  const transition = await syncTitle(tmdbId, mediaType, 'US')
  const arrives = await countEvents(first.titleId, ['ARRIVES_ON_MY_SERVICE'])
  const debut = await countEvents(first.titleId, ['STREAMING_DEBUT'])
  console.log('real transition — arrivals (want >=1):', arrives)
  console.log('real transition — debut    (want  1):', debut)

  // --- idempotent ----------------------------------------------------------
  const repeat = await syncTitle(tmdbId, mediaType, 'US')
  console.log('re-sync emitted (want 0):', repeat.events)

  const ok =
    afterBackfill === 0 &&
    arrives >= 1 &&
    debut === 1 &&
    transition.events > 0 &&
    repeat.events === 0

  console.log(ok ? '\nPASS' : '\nFAIL')
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
