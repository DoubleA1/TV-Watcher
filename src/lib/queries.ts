import { prisma } from './db'
import { catalog } from './providers'
import type { MediaType, OfferType } from '@/generated/prisma/enums'

export type PlateTitle = {
  id: string
  name: string
  mediaType: MediaType
  posterPath: string | null
  year: string | null
  status: string | null
  followers: number
}

const year = (d: Date | null) => (d ? String(d.getUTCFullYear()) : null)

/**
 * What other people have started following recently.
 *
 * Ordered by follows in the window rather than raw popularity, so the rail
 * reflects the community instead of restating a TMDB chart. Falls back to
 * popularity while the window is empty, which it will be on day one.
 */
export async function getCommunityTrending(limit = 12): Promise<PlateTitle[]> {
  const since = new Date(Date.now() - 7 * 86_400_000)

  const grouped = await prisma.follow.groupBy({
    by: ['titleId'],
    where: { createdAt: { gte: since } },
    _count: { titleId: true },
    orderBy: { _count: { titleId: 'desc' } },
    take: limit,
  })

  if (grouped.length > 0) {
    const titles = await prisma.title.findMany({
      where: { id: { in: grouped.map((g) => g.titleId) } },
      select: {
        id: true, name: true, mediaType: true, posterPath: true,
        releaseDate: true, status: true,
      },
    })
    const counts = new Map(grouped.map((g) => [g.titleId, g._count.titleId]))
    return titles
      .map((t) => ({
        id: t.id,
        name: t.name,
        mediaType: t.mediaType,
        posterPath: t.posterPath,
        year: year(t.releaseDate),
        status: t.status,
        followers: counts.get(t.id) ?? 0,
      }))
      .sort((a, b) => b.followers - a.followers)
  }

  const fallback = await prisma.title.findMany({
    orderBy: { popularity: 'desc' },
    take: limit,
    select: {
      id: true, name: true, mediaType: true, posterPath: true,
      releaseDate: true, status: true,
    },
  })
  return fallback.map((t) => ({
    id: t.id,
    name: t.name,
    mediaType: t.mediaType,
    posterPath: t.posterPath,
    year: year(t.releaseDate),
    status: t.status,
    followers: 0,
  }))
}

/**
 * Search.
 *
 * Reads what we already hold first so the common case costs no upstream
 * quota, then asks the catalogue source when we come up short — and stores
 * whatever it returns, so the second search for the same thing is local.
 */
export async function searchCatalog(query: string, limit = 12): Promise<PlateTitle[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const local = await prisma.title.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    orderBy: { popularity: 'desc' },
    take: limit,
    select: {
      id: true, name: true, mediaType: true, posterPath: true,
      releaseDate: true, status: true,
      _count: { select: { follows: true } },
    },
  })

  if (local.length >= 5) {
    return local.map((t) => ({
      id: t.id,
      name: t.name,
      mediaType: t.mediaType,
      posterPath: t.posterPath,
      year: year(t.releaseDate),
      status: t.status,
      followers: t._count.follows,
    }))
  }

  const known = new Set(local.map((t) => `${t.name}`.toLowerCase()))
  const remote = await catalog().search(q, { limit }).catch(() => [])

  const merged = [...local.map((t) => ({
    id: t.id,
    name: t.name,
    mediaType: t.mediaType,
    posterPath: t.posterPath,
    year: year(t.releaseDate),
    status: t.status,
    followers: t._count.follows,
  }))]

  for (const r of remote) {
    if (known.has(r.name.toLowerCase())) continue
    // Persist on sight so following it later has something to point at.
    const stored = await prisma.title.upsert({
      where: { tmdbId_mediaType: { tmdbId: r.tmdbId, mediaType: r.mediaType } },
      create: {
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        name: r.name,
        overview: r.overview ?? null,
        posterPath: r.posterPath ?? null,
        releaseDate: r.releaseDate ? new Date(r.releaseDate) : null,
        status: r.status ?? null,
        popularity: r.popularity ?? 0,
      },
      update: {},
      select: { id: true, name: true, mediaType: true, posterPath: true, releaseDate: true, status: true },
    })
    merged.push({
      id: stored.id,
      name: stored.name,
      mediaType: stored.mediaType,
      posterPath: stored.posterPath,
      year: year(stored.releaseDate),
      status: stored.status,
      followers: 0,
    })
    if (merged.length >= limit) break
  }

  return merged
}

export type TitlePageData = Awaited<ReturnType<typeof getTitlePage>>

export async function getTitlePage(titleId: string, userId: string | null) {
  const title = await prisma.title.findUnique({
    where: { id: titleId },
    select: {
      id: true, name: true, mediaType: true, overview: true, posterPath: true,
      releaseDate: true, status: true, voteAverage: true, hasEverStreamed: true,
      collection: { select: { id: true, name: true } },
      _count: { select: { follows: true } },
    },
  })
  if (!title) return null

  const availability = await prisma.availability.findMany({
    where: { titleId, removedAt: null },
    select: {
      offerType: true,
      provider: { select: { id: true, name: true, tmdbProviderId: true, displayPriority: true } },
    },
    orderBy: { provider: { displayPriority: 'asc' } },
  })

  const mine = userId
    ? new Set(
        (
          await prisma.userService.findMany({
            where: { userId },
            select: { providerId: true },
          })
        ).map((s) => s.providerId),
      )
    : new Set<string>()

  const follow = userId
    ? await prisma.follow.findUnique({
        where: { userId_titleId: { userId, titleId } },
        select: {
          id: true,
          offerTypes: true,
          anyService: true,
          alerts: { select: { eventType: true, enabled: true } },
        },
      })
    : null

  const nextEvent = await prisma.releaseEvent.findFirst({
    where: { titleId, occursAt: { gt: new Date() } },
    orderBy: { occursAt: 'asc' },
    select: { eventType: true, occursAt: true, payload: true },
  })

  return {
    title: { ...title, year: year(title.releaseDate), followers: title._count.follows },
    offers: availability.map((a) => ({
      offerType: a.offerType,
      providerId: a.provider.id,
      providerName: a.provider.name,
      subscribed: mine.has(a.provider.id),
    })),
    follow,
    nextEvent,
  }
}

/** Upcoming events across everything a user follows, with alerts enabled. */
export async function getUserQueue(userId: string, limit = 25) {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true, follow: { userId } },
    select: { eventType: true, follow: { select: { titleId: true } } },
  })

  if (rules.length === 0) return []

  const byTitle = new Map<string, Set<string>>()
  for (const r of rules) {
    const set = byTitle.get(r.follow.titleId) ?? new Set<string>()
    set.add(r.eventType)
    byTitle.set(r.follow.titleId, set)
  }

  const events = await prisma.releaseEvent.findMany({
    where: { titleId: { in: [...byTitle.keys()] }, occursAt: { gt: new Date() } },
    orderBy: { occursAt: 'asc' },
    take: limit * 3,
    select: {
      id: true, eventType: true, occursAt: true, payload: true,
      title: { select: { id: true, name: true, posterPath: true } },
    },
  })

  // Keep only events whose type this user actually asked for.
  return events
    .filter((e) => byTitle.get(e.title.id)?.has(e.eventType))
    .slice(0, limit)
}

export async function getUserFollows(userId: string): Promise<PlateTitle[]> {
  const follows = await prisma.follow.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      title: {
        select: {
          id: true, name: true, mediaType: true, posterPath: true,
          releaseDate: true, status: true,
          _count: { select: { follows: true } },
        },
      },
    },
  })

  return follows.map(({ title: t }) => ({
    id: t.id,
    name: t.name,
    mediaType: t.mediaType,
    posterPath: t.posterPath,
    year: year(t.releaseDate),
    status: t.status,
    followers: t._count.follows,
  }))
}

export async function getUserServices(userId: string) {
  const [all, mine] = await Promise.all([
    prisma.provider.findMany({ orderBy: { displayPriority: 'asc' }, take: 24 }),
    prisma.userService.findMany({ where: { userId }, select: { providerId: true } }),
  ])
  const owned = new Set(mine.map((m) => m.providerId))
  return all.map((p) => ({ id: p.id, name: p.name, subscribed: owned.has(p.id) }))
}

export const OFFER_LABEL: Record<OfferType, string> = {
  FLATRATE: 'Included',
  ADS: 'Free with ads',
  FREE: 'Free',
  RENT: 'Rent',
  BUY: 'Buy',
}
