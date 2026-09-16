/**
 * Seeds a browsable database.
 *
 * This runs the real ingest path against whichever catalogue source is
 * configured, so with no TMDB key it fills the database from fixtures and
 * with a key it pulls live data. Either way the code exercised here is the
 * same code the scheduled poller runs.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { catalog } from '../src/lib/providers'
import { syncProviders, syncTitle } from '../src/lib/sync'
import { FIXTURE_CATALOG } from '../src/lib/providers/fixtures/catalog'
import { hashPassword } from '../src/lib/auth/password'
import { EventType } from '../src/generated/prisma/enums'

const DEMO_EMAIL = 'demo@tvwatcher.local'

/** Services the demo account "pays for" — drives the you-have-this badges. */
const DEMO_SERVICES = ['Max', 'Hulu', 'Apple TV+']

const DEMO_FOLLOWS = [
  'Severance',
  'The Bear',
  'Fallout',
  'Silo',
  'Dune: Part Three',
  'The Last of Us',
  'Andor',
  'Poor Things',
  'Dune: Part Two',
]

async function main() {
  const source = catalog()
  console.log(`source: ${source.id} (live: ${source.isLive})`)

  // Clear anything the smoke test left behind.
  await prisma.title.deleteMany({ where: { tmdbId: { lt: 0 } } })

  console.log('syncing provider directory…')
  const providerCount = await syncProviders('US')
  console.log(`  ${providerCount} providers`)

  console.log('ingesting catalogue…')
  let events = 0
  for (const entry of FIXTURE_CATALOG) {
    const res = await syncTitle(entry.title.tmdbId, entry.title.mediaType, 'US')
    if (res.titleId) events += res.events
  }
  const titleCount = await prisma.title.count()
  console.log(`  ${titleCount} titles, ${events} release events detected`)

  // --- demo account --------------------------------------------------------
  console.log('creating demo account…')
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } })

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: await hashPassword('watchthis123'),
      emailVerifiedAt: new Date(),
      displayName: 'Demo',
      timezone: 'America/Los_Angeles',
      region: 'US',
      emailEnabled: true,
      // SMS stays off until A2P 10DLC registration clears.
      smsEnabled: false,
    },
  })

  const services = await prisma.provider.findMany({ where: { name: { in: DEMO_SERVICES } } })
  for (const p of services) {
    await prisma.userService.create({ data: { userId: user.id, providerId: p.id } })
  }
  console.log(`  subscribed to ${services.length} services`)

  for (const name of DEMO_FOLLOWS) {
    const title = await prisma.title.findFirst({ where: { name } })
    if (!title) continue

    await prisma.follow.create({
      data: {
        userId: user.id,
        titleId: title.id,
        alerts: {
          create: Object.values(EventType).map((eventType) => ({
            eventType,
            // Episode-level alerts stay opt-in: ten texts for ten episodes
            // is how you train someone to ignore your texts.
            enabled: eventType !== EventType.NEW_EPISODE,
          })),
        },
      },
    })
  }
  console.log(`  following ${DEMO_FOLLOWS.length} titles`)

  // --- ambient activity ----------------------------------------------------
  // The welcome page shows what other people started following. With one
  // account that list is empty, so seed some neighbours.
  console.log('seeding community activity…')
  await prisma.user.deleteMany({ where: { email: { startsWith: 'neighbour-' } } })

  const allTitles = await prisma.title.findMany({ select: { id: true, popularity: true } })
  let follows = 0

  for (let i = 0; i < 24; i++) {
    const neighbour = await prisma.user.create({
      data: { email: `neighbour-${i}@tvwatcher.local`, displayName: `Viewer ${i + 1}` },
    })

    // Weight by popularity so the trending rail has a believable shape
    // rather than a uniform scatter.
    const picks = allTitles
      .map((t) => ({ t, score: Math.random() * (t.popularity + 40) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3 + (i % 4))

    for (const { t } of picks) {
      await prisma.follow.create({
        data: {
          userId: neighbour.id,
          titleId: t.id,
          // Spread across the last few days so "in the last 24 hours" is
          // a real filter rather than everything at once.
          createdAt: new Date(Date.now() - Math.random() * 3 * 86_400_000),
          alerts: {
            create: [
              { eventType: EventType.SEASON_PREMIERE },
              { eventType: EventType.ARRIVES_ON_MY_SERVICE },
            ],
          },
        },
      })
      follows++
    }
  }
  console.log(`  ${follows} follows across 24 accounts`)

  const eventCount = await prisma.releaseEvent.count()
  console.log(`\ndone. ${eventCount} release events armed.`)
  console.log(`sign in with ${DEMO_EMAIL} / watchthis123`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
