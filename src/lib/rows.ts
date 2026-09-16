import { prisma } from './db'
import type { PlateTitle } from './queries'

/**
 * Homepage rows.
 *
 * Every row here is a database query over facts we already store — release
 * dates, availability, popularity and its delta. None of it is editorial
 * guesswork, which matters: a row called "released today" has to be
 * literally true or the page stops being trustworthy.
 */

export type Row = {
  key: string
  heading: string
  note?: string
  titles: PlateTitle[]
  /** Rendered larger, for rows worth stopping on. */
  feature?: boolean
}

const SELECT = {
  id: true,
  name: true,
  mediaType: true,
  posterPath: true,
  releaseDate: true,
  status: true,
  popularity: true,
  voteAverage: true,
  genres: true,
  _count: { select: { follows: true } },
} as const

type Raw = {
  id: string
  name: string
  mediaType: 'MOVIE' | 'TV'
  posterPath: string | null
  releaseDate: Date | null
  status: string | null
  _count: { follows: number }
}

function toPlate(t: Raw): PlateTitle {
  return {
    id: t.id,
    name: t.name,
    mediaType: t.mediaType,
    posterPath: t.posterPath,
    year: t.releaseDate ? String(t.releaseDate.getUTCFullYear()) : null,
    status: t.status,
    followers: t._count.follows,
  }
}

const DAY = 86_400_000

/** Titles that became streamable today, in this region. */
async function releasedToday(): Promise<PlateTitle[]> {
  const since = new Date(Date.now() - DAY)
  const arrivals = await prisma.availability.findMany({
    where: { firstSeenAt: { gte: since }, removedAt: null, offerType: 'FLATRATE' },
    distinct: ['titleId'],
    take: 20,
    orderBy: { firstSeenAt: 'desc' },
    select: { title: { select: SELECT } },
  })
  return arrivals.map((a) => toPlate(a.title))
}

async function newMovies(): Promise<PlateTitle[]> {
  const rows = await prisma.title.findMany({
    where: {
      mediaType: 'MOVIE',
      // Released, and released recently. The upper bound matters: without it
      // a film dated two years out ranks first in "new releases", which is
      // exactly backwards.
      releaseDate: { gte: new Date(Date.now() - 1100 * DAY), lte: new Date() },
    },
    orderBy: [{ releaseDate: 'desc' }, { popularity: 'desc' }],
    take: 20,
    select: SELECT,
  })
  return rows.map(toPlate)
}

async function popularShows(): Promise<PlateTitle[]> {
  const rows = await prisma.title.findMany({
    where: { mediaType: 'TV' },
    orderBy: { popularity: 'desc' },
    take: 20,
    select: SELECT,
  })
  return rows.map(toPlate)
}

/**
 * Biggest climbers. Popularity alone rewards things that have been famous
 * for a decade; the delta surfaces what is moving now.
 */
async function quickRisers(): Promise<PlateTitle[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Title"
    WHERE "priorPopularity" > 0
    ORDER BY (popularity - "priorPopularity") DESC
    LIMIT 20
  `
  if (rows.length === 0) {
    // Nothing has been synced twice yet, so no delta exists. Fall back to
    // recent arrivals rather than showing an empty row.
    const recent = await prisma.title.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: SELECT,
    })
    return recent.map(toPlate)
  }
  const titles = await prisma.title.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: SELECT,
  })
  const order = new Map(rows.map((r, i) => [r.id, i]))
  return titles.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toPlate)
}

/** Things with an armed event inside the next week. */
async function droppingThisWeek(): Promise<PlateTitle[]> {
  const events = await prisma.releaseEvent.findMany({
    where: {
      occursAt: { gte: new Date(), lte: new Date(Date.now() + 7 * DAY) },
      eventType: { in: ['SEASON_PREMIERE', 'NEW_EPISODE'] },
    },
    orderBy: { occursAt: 'asc' },
    distinct: ['titleId'],
    take: 20,
    select: { title: { select: SELECT } },
  })
  return events.map((e) => toPlate(e.title))
}

/** Announced or in production, not out yet, and people care. */
async function upcomingBlockbusters(): Promise<PlateTitle[]> {
  const rows = await prisma.title.findMany({
    where: {
      OR: [
        { status: { in: ['Post Production', 'In Production', 'Planned'] } },
        { releaseDate: { gt: new Date() } },
      ],
    },
    orderBy: { popularity: 'desc' },
    take: 20,
    select: SELECT,
  })
  return rows.map(toPlate)
}

/** Never streamable anywhere — the "finally streaming" watchlist. */
async function notStreamingYet(): Promise<PlateTitle[]> {
  const rows = await prisma.title.findMany({
    where: { hasEverStreamed: false },
    orderBy: { popularity: 'desc' },
    take: 20,
    select: SELECT,
  })
  return rows.map(toPlate)
}

async function highestRated(): Promise<PlateTitle[]> {
  const rows = await prisma.title.findMany({
    where: { voteCount: { gte: 500 } },
    orderBy: { voteAverage: 'desc' },
    take: 20,
    select: SELECT,
  })
  return rows.map(toPlate)
}

async function byGenre(genre: string): Promise<PlateTitle[]> {
  const rows = await prisma.title.findMany({
    where: { genres: { has: genre } },
    orderBy: { popularity: 'desc' },
    take: 20,
    select: SELECT,
  })
  return rows.map(toPlate)
}

/** Included with a subscription on a specific service. */
async function onService(providerId: string): Promise<PlateTitle[]> {
  const rows = await prisma.availability.findMany({
    where: { providerId, removedAt: null, offerType: 'FLATRATE' },
    distinct: ['titleId'],
    take: 20,
    orderBy: { title: { popularity: 'desc' } },
    select: { title: { select: SELECT } },
  })
  return rows.map((a) => toPlate(a.title))
}

/**
 * Build the homepage.
 *
 * Personalised where we can: a signed-in user with services gets a row for
 * the one they have, positioned high because "on a service you already pay
 * for" is the most actionable row on the page.
 */
export async function buildHomeRows(userId: string | null): Promise<Row[]> {
  let service: { id: string; name: string } | null = null
  if (userId) {
    const owned = await prisma.userService.findFirst({
      where: { userId },
      orderBy: { provider: { displayPriority: 'asc' } },
      select: { provider: { select: { id: true, name: true } } },
    })
    service = owned?.provider ?? null
  }

  const [
    today,
    week,
    movies,
    shows,
    risers,
    blockbusters,
    unstreamed,
    rated,
    scifi,
    horror,
    comedy,
    serviceRow,
  ] = await Promise.all([
    releasedToday(),
    droppingThisWeek(),
    newMovies(),
    popularShows(),
    quickRisers(),
    upcomingBlockbusters(),
    notStreamingYet(),
    highestRated(),
    byGenre('Science Fiction'),
    byGenre('Horror'),
    byGenre('Comedy'),
    service ? onService(service.id) : Promise.resolve([]),
  ])

  const rows: Row[] = [
    { key: 'week', heading: 'Dropping this week', note: 'Already armed — you will get the text', titles: week, feature: true },
    { key: 'today', heading: 'Landed in the last day', note: 'New to streaming', titles: today },
    ...(service && serviceRow.length
      ? [{
          key: 'service',
          heading: `Popular on ${service.name}`,
          note: 'Included with what you already pay for',
          titles: serviceRow,
        }]
      : []),
    { key: 'shows', heading: 'Popular shows right now', titles: shows },
    { key: 'movies', heading: 'New movie releases', titles: movies },
    { key: 'risers', heading: 'Climbing fast', note: 'Biggest jump since our last check', titles: risers },
    { key: 'blockbusters', heading: 'Upcoming blockbusters', note: 'Not out yet — follow now, hear first', titles: blockbusters, feature: true },
    { key: 'unstreamed', heading: 'Not streaming anywhere yet', note: 'The ones worth waiting for', titles: unstreamed },
    { key: 'rated', heading: 'Highest rated', titles: rated },
    { key: 'scifi', heading: 'Science fiction', titles: scifi },
    { key: 'horror', heading: 'Horror', titles: horror },
    { key: 'comedy', heading: 'Comedy', titles: comedy },
  ]

  // A rail with one or two cards reads as broken rather than as sparse, so
  // the bar is a rail that actually looks like a rail.
  const MIN_PER_ROW = 4
  return rows.filter((r) => r.titles.length >= MIN_PER_ROW)
}
