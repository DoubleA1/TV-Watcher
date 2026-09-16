/**
 * Ingest and detection.
 *
 * One code path serves both the fixture source and TMDB, so seeding the
 * database and running the real poller are the same operation with a
 * different source plugged in.
 *
 * Detection happens here rather than in a separate pass because this is the
 * only place that holds both the previous stored state and the freshly
 * fetched state at the same time. Every event is written with a dedupeKey
 * and a unique index behind it, so an upstream API that flaps cannot text
 * anyone twice.
 */
import { prisma } from './db'
import { catalog, type MediaKind, type OfferKind, type SourceEpisode } from './providers'
import { getEpisodes, matchShow } from './providers/tvmaze'
import type { EventType, RefreshTier } from '@/generated/prisma/enums'

const HOUR = 3_600_000
const DAY = 24 * HOUR

type SyncStats = {
  titlesTouched: number
  eventsCreated: number
  errors: string[]
}

/** Refresh the provider directory for a region. */
export async function syncProviders(region = 'US'): Promise<number> {
  const providers = await catalog().listProviders(region)
  for (const p of providers) {
    await prisma.provider.upsert({
      where: { tmdbProviderId: p.providerId },
      create: {
        tmdbProviderId: p.providerId,
        name: p.name,
        logoPath: p.logoPath ?? null,
        displayPriority: p.displayPriority,
      },
      update: { name: p.name, logoPath: p.logoPath ?? null, displayPriority: p.displayPriority },
    })
  }
  return providers.length
}

/**
 * How soon to look at this title again.
 *
 * Polling a film that is still in theatres every hour for streaming data
 * that cannot exist yet is pure waste, so cadence tracks how close the
 * title is to something actually happening.
 */
function scheduleRefresh(opts: {
  nextOccurrence: Date | null
  status: string | null
  hasEverStreamed: boolean
}): { tier: RefreshTier; nextRefreshAt: Date } {
  const now = Date.now()

  if (opts.nextOccurrence) {
    const until = opts.nextOccurrence.getTime() - now
    // Inside the final stretch, check often enough that a schedule change
    // cannot silently invalidate an armed alert.
    if (until <= 2 * DAY) return { tier: 'HOT', nextRefreshAt: new Date(now + HOUR) }
    if (until <= 21 * DAY) return { tier: 'WARM', nextRefreshAt: new Date(now + 6 * HOUR) }
  }

  // A film that has never streamed is the one to watch: its debut can land
  // without warning once the theatrical window closes.
  if (!opts.hasEverStreamed && opts.status !== 'Ended') {
    return { tier: 'WARM', nextRefreshAt: new Date(now + 12 * HOUR) }
  }

  if (opts.status === 'Ended' || opts.status === 'Canceled') {
    return { tier: 'DORMANT', nextRefreshAt: new Date(now + 14 * DAY) }
  }

  return { tier: 'COLD', nextRefreshAt: new Date(now + 2 * DAY) }
}

/** Create a ReleaseEvent unless its dedupeKey already exists. */
async function recordEvent(args: {
  titleId: string
  eventType: EventType
  dedupeKey: string
  occursAt: Date
  payload?: Record<string, unknown>
}): Promise<boolean> {
  const existing = await prisma.releaseEvent.findUnique({
    where: { dedupeKey: args.dedupeKey },
    select: { id: true },
  })
  if (existing) return false

  try {
    await prisma.releaseEvent.create({
      data: {
        titleId: args.titleId,
        eventType: args.eventType,
        dedupeKey: args.dedupeKey,
        occursAt: args.occursAt,
        payload: (args.payload ?? {}) as never,
      },
    })
    return true
  } catch {
    // Lost a race with a concurrent sync; the unique index did its job.
    return false
  }
}

/** Merge TVmaze's precise timestamps over TMDB's date-only episodes. */
function mergeEpisodes(tmdb: SourceEpisode[], maze: SourceEpisode[]): SourceEpisode[] {
  if (maze.length === 0) return tmdb
  const key = (e: SourceEpisode) => `${e.seasonNumber}:${e.episodeNumber}`
  const byKey = new Map(tmdb.map((e) => [key(e), e]))

  for (const m of maze) {
    const existing = byKey.get(key(m))
    if (existing) {
      byKey.set(key(m), { ...existing, airstamp: m.airstamp ?? existing.airstamp })
    } else {
      byKey.set(key(m), m)
    }
  }
  return [...byKey.values()]
}

/** When an episode actually unlocks. Midnight local is the honest fallback. */
function episodeInstant(ep: SourceEpisode): Date | null {
  if (ep.airstamp) {
    const d = new Date(ep.airstamp)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (ep.airDate) {
    const d = new Date(`${ep.airDate}T00:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

/**
 * Pull one title, store it, and emit events for anything that changed.
 */
export async function syncTitle(
  tmdbId: number,
  mediaType: MediaKind,
  region = 'US',
): Promise<{ titleId: string | null; events: number }> {
  const source = catalog()
  const detail = await source.getTitle(tmdbId, mediaType)
  if (!detail) return { titleId: null, events: 0 }

  let events = 0

  const prior = await prisma.title.findUnique({
    where: { tmdbId_mediaType: { tmdbId, mediaType } },
    select: { id: true, hasEverStreamed: true, popularity: true },
  })

  // First time we have ever looked at this title, everything about it is
  // "new" — every service it is on looks like an arrival and its long-ago
  // streaming debut looks like it just happened. Backfilling a catalogue
  // would fire an alert per title per service. So the first pass records
  // state silently and only later changes are news.
  const isFirstIngest = prior === null

  // --- collection ---------------------------------------------------------
  let collectionId: string | null = null
  if (detail.title.collection) {
    const col = await prisma.collection.upsert({
      where: { tmdbId: detail.title.collection.tmdbId },
      create: {
        tmdbId: detail.title.collection.tmdbId,
        name: detail.title.collection.name,
        posterPath: detail.title.collection.posterPath ?? null,
      },
      update: { name: detail.title.collection.name },
    })
    collectionId = col.id
  }

  // --- title ---------------------------------------------------------------
  const releaseDate = detail.title.releaseDate ? new Date(detail.title.releaseDate) : null

  const title = await prisma.title.upsert({
    where: { tmdbId_mediaType: { tmdbId, mediaType } },
    create: {
      tmdbId,
      mediaType,
      name: detail.title.name,
      originalName: detail.title.originalName ?? null,
      overview: detail.title.overview ?? null,
      posterPath: detail.title.posterPath ?? null,
      backdropPath: detail.title.backdropPath ?? null,
      releaseDate: releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate : null,
      status: detail.title.status ?? null,
      popularity: detail.title.popularity ?? 0,
      priorPopularity: detail.title.popularity ?? 0,
      voteAverage: detail.title.voteAverage ?? 0,
      voteCount: detail.title.voteCount ?? 0,
      genres: detail.title.genres ?? [],
      collectionId,
    },
    update: {
      name: detail.title.name,
      overview: detail.title.overview ?? null,
      posterPath: detail.title.posterPath ?? null,
      status: detail.title.status ?? null,
      // Carry the old value forward before overwriting: the delta is what
      // "climbing fast" means, and it is lost if we only ever store current.
      priorPopularity: prior?.popularity ?? detail.title.popularity ?? 0,
      popularity: detail.title.popularity ?? 0,
      voteAverage: detail.title.voteAverage ?? 0,
      voteCount: detail.title.voteCount ?? 0,
      genres: detail.title.genres ?? [],
      collectionId,
      lastRefreshedAt: new Date(),
    },
  })

  // --- seasons -------------------------------------------------------------
  const knownSeasons = new Set(
    (
      await prisma.season.findMany({
        where: { titleId: title.id },
        select: { seasonNumber: true },
      })
    ).map((s) => s.seasonNumber),
  )

  for (const s of detail.seasons) {
    await prisma.season.upsert({
      where: { titleId_seasonNumber: { titleId: title.id, seasonNumber: s.seasonNumber } },
      create: {
        titleId: title.id,
        seasonNumber: s.seasonNumber,
        name: s.name ?? null,
        overview: s.overview ?? null,
        posterPath: s.posterPath ?? null,
        airDate: s.airDate ? new Date(s.airDate) : null,
        episodeCount: s.episodeCount,
      },
      update: {
        name: s.name ?? null,
        airDate: s.airDate ? new Date(s.airDate) : null,
        episodeCount: s.episodeCount,
      },
    })
  }

  // --- episodes ------------------------------------------------------------
  let episodes = detail.episodes
  if (mediaType === 'TV') {
    // TVmaze is the only source with a real instant rather than a date.
    const existing = await prisma.title.findUnique({
      where: { id: title.id },
      select: { tvmazeId: true },
    })
    let tvmazeId = existing?.tvmazeId ?? null
    if (tvmazeId === null && source.isLive) {
      try {
        tvmazeId = await matchShow({ name: detail.title.name })
        if (tvmazeId) {
          await prisma.title.update({ where: { id: title.id }, data: { tvmazeId } })
        }
      } catch {
        // TVmaze is a bonus, not a dependency.
      }
    }
    if (tvmazeId) {
      try {
        episodes = mergeEpisodes(episodes, await getEpisodes(tvmazeId))
      } catch {
        /* keep TMDB dates */
      }
    }
  }

  for (const ep of episodes) {
    const instant = episodeInstant(ep)
    await prisma.episode.upsert({
      where: {
        titleId_seasonNumber_episodeNumber: {
          titleId: title.id,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
        },
      },
      create: {
        titleId: title.id,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        name: ep.name ?? null,
        overview: ep.overview ?? null,
        airDate: ep.airDate ? new Date(ep.airDate) : null,
        airstamp: instant,
        runtime: ep.runtime ?? null,
      },
      update: {
        name: ep.name ?? null,
        airDate: ep.airDate ? new Date(ep.airDate) : null,
        airstamp: instant,
      },
    })
  }

  // Offers are fetched before detection rather than after, so a premiere
  // message can name the service it lands on. "Severance S3 is live on
  // Apple TV+" is a materially better text than the same line without it.
  const offers = await source.getOffers(tmdbId, mediaType, region)
  const includedOn = offers.find((o) => o.offerKind === 'FLATRATE')?.providerName ?? null

  // --- 1. season premieres -------------------------------------------------
  const now = new Date()
  for (const s of detail.seasons) {
    if (s.seasonNumber === 0) continue // specials
    const first = episodes
      .filter((e) => e.seasonNumber === s.seasonNumber)
      .sort((a, b) => a.episodeNumber - b.episodeNumber)[0]

    const when = first ? episodeInstant(first) : s.airDate ? new Date(`${s.airDate}T00:00:00`) : null
    if (!when || Number.isNaN(when.getTime())) continue

    // Only arm things that have not already happened. Back-filling history
    // would text everyone about seasons that aired years ago.
    const isNew = !knownSeasons.has(s.seasonNumber)
    if (when.getTime() < now.getTime() && !isNew) continue
    if (when.getTime() < now.getTime() - 2 * DAY) continue

    if (
      await recordEvent({
        titleId: title.id,
        eventType: 'SEASON_PREMIERE',
        dedupeKey: `SEASON_PREMIERE:${title.id}:s${s.seasonNumber}`,
        occursAt: when,
        payload: {
          seasonNumber: s.seasonNumber,
          titleName: title.name,
          providerName: includedOn,
        },
      })
    ) {
      events++
    }
  }

  // --- 2. individual episodes ----------------------------------------------
  for (const ep of episodes) {
    if (ep.seasonNumber === 0 || ep.episodeNumber === 1) continue // premiere covers E01
    const when = episodeInstant(ep)
    if (!when || when.getTime() < now.getTime()) continue

    if (
      await recordEvent({
        titleId: title.id,
        eventType: 'NEW_EPISODE',
        dedupeKey: `NEW_EPISODE:${title.id}:s${ep.seasonNumber}e${ep.episodeNumber}`,
        occursAt: when,
        payload: {
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          titleName: title.name,
          providerName: includedOn,
        },
      })
    ) {
      events++
    }
  }

  // --- 3. franchise entries ------------------------------------------------
  if (collectionId && detail.collectionEntries.length > 0) {
    for (const entry of detail.collectionEntries) {
      if (entry.tmdbId === tmdbId) continue

      const seen = await prisma.title.findUnique({
        where: { tmdbId_mediaType: { tmdbId: entry.tmdbId, mediaType: entry.mediaType } },
        select: { id: true },
      })
      if (seen) continue // already known, not news

      const created = await prisma.title.create({
        data: {
          tmdbId: entry.tmdbId,
          mediaType: entry.mediaType,
          name: entry.name,
          overview: entry.overview ?? null,
          posterPath: entry.posterPath ?? null,
          releaseDate: entry.releaseDate ? new Date(entry.releaseDate) : null,
          status: entry.status ?? null,
          popularity: entry.popularity ?? 0,
          genres: entry.genres ?? [],
          collectionId,
        },
      })

      // A sequel being announced is news now, even with no release date.
      if (
        await recordEvent({
          titleId: title.id,
          eventType: 'FRANCHISE_ENTRY',
          dedupeKey: `FRANCHISE_ENTRY:${collectionId}:${entry.tmdbId}`,
          occursAt: now,
          payload: {
            newTitleId: created.id,
            newTitleName: entry.name,
            releaseDate: entry.releaseDate ?? null,
            titleName: title.name,
          },
        })
      ) {
        events++
      }
    }
  }

  // --- 4 & 5. availability --------------------------------------------------
  const priorActive = await prisma.availability.findMany({
    where: { titleId: title.id, region, removedAt: null },
    select: { providerId: true, offerType: true },
  })
  const priorKeys = new Set(priorActive.map((a) => `${a.providerId}:${a.offerType}`))

  const seenKeys = new Set<string>()
  const arrivals: Array<{ providerDbId: string; providerName: string; kind: OfferKind }> = []

  for (const offer of offers) {
    const provider = await prisma.provider.upsert({
      where: { tmdbProviderId: offer.providerId },
      create: {
        tmdbProviderId: offer.providerId,
        name: offer.providerName,
        logoPath: offer.logoPath ?? null,
        displayPriority: offer.displayPriority ?? 999,
      },
      update: { name: offer.providerName },
    })

    const key = `${provider.id}:${offer.offerKind}`
    seenKeys.add(key)

    await prisma.availability.upsert({
      where: {
        titleId_region_providerId_offerType: {
          titleId: title.id,
          region,
          providerId: provider.id,
          offerType: offer.offerKind,
        },
      },
      create: {
        titleId: title.id,
        region,
        providerId: provider.id,
        offerType: offer.offerKind,
      },
      update: { lastSeenAt: new Date(), removedAt: null },
    })

    if (!priorKeys.has(key)) {
      arrivals.push({
        providerDbId: provider.id,
        providerName: provider.name,
        kind: offer.offerKind,
      })
    }
  }

  // Tombstone anything that vanished, rather than deleting: the history of a
  // title moving between services is what makes transitions detectable.
  for (const gone of priorActive) {
    if (!seenKeys.has(`${gone.providerId}:${gone.offerType}`)) {
      await prisma.availability.updateMany({
        where: {
          titleId: title.id,
          region,
          providerId: gone.providerId,
          offerType: gone.offerType,
          removedAt: null,
        },
        data: { removedAt: new Date() },
      })
    }
  }

  const day = now.toISOString().slice(0, 10)
  for (const arrival of isFirstIngest ? [] : arrivals) {
    if (
      await recordEvent({
        titleId: title.id,
        eventType: 'ARRIVES_ON_MY_SERVICE',
        // Bucketed by day so a title that leaves and returns can alert
        // again, without a flapping API alerting hourly.
        dedupeKey: `ARRIVES:${title.id}:${region}:${arrival.providerDbId}:${arrival.kind}:${day}`,
        occursAt: now,
        payload: {
          providerId: arrival.providerDbId,
          providerName: arrival.providerName,
          offerType: arrival.kind,
          region,
          titleName: title.name,
        },
      })
    ) {
      events++
    }
  }

  // Streaming debut: never streamable anywhere, now streamable. Rent and buy
  // do not count — "you can pay $19.99 for it" is not the thing people are
  // waiting to hear.
  const streamsNow = offers.some(
    (o) => o.offerKind === 'FLATRATE' || o.offerKind === 'ADS' || o.offerKind === 'FREE',
  )
  if (streamsNow && !(prior?.hasEverStreamed ?? false)) {
    await prisma.title.update({ where: { id: title.id }, data: { hasEverStreamed: true } })

    const included = offers.find((o) => o.offerKind === 'FLATRATE') ?? offers[0]
    if (
      !isFirstIngest &&
      await recordEvent({
        titleId: title.id,
        eventType: 'STREAMING_DEBUT',
        dedupeKey: `STREAMING_DEBUT:${title.id}`,
        occursAt: now,
        payload: {
          providerName: included?.providerName ?? null,
          offerType: included?.offerKind ?? null,
          titleName: title.name,
        },
      })
    ) {
      events++
    }
  }

  // --- cadence -------------------------------------------------------------
  const nextEvent = await prisma.releaseEvent.findFirst({
    where: { titleId: title.id, occursAt: { gt: now } },
    orderBy: { occursAt: 'asc' },
    select: { occursAt: true },
  })

  const { tier, nextRefreshAt } = scheduleRefresh({
    nextOccurrence: nextEvent?.occursAt ?? null,
    status: detail.title.status ?? null,
    hasEverStreamed: streamsNow || (prior?.hasEverStreamed ?? false),
  })

  await prisma.title.update({
    where: { id: title.id },
    data: { refreshTier: tier, nextRefreshAt, lastRefreshedAt: now },
  })

  return { titleId: title.id, events }
}

/**
 * The poller. Refreshes every title that is due, oldest first.
 *
 * Only titles somebody follows are worth spending upstream quota on, plus
 * whatever the welcome page needs to look populated.
 */
export async function syncDueTitles(limit = 25): Promise<SyncStats> {
  const stats: SyncStats = { titlesTouched: 0, eventsCreated: 0, errors: [] }

  const due = await prisma.title.findMany({
    where: { nextRefreshAt: { lte: new Date() } },
    orderBy: { nextRefreshAt: 'asc' },
    take: limit,
    select: { tmdbId: true, mediaType: true, name: true },
  })

  for (const t of due) {
    try {
      const res = await syncTitle(t.tmdbId, t.mediaType)
      stats.titlesTouched++
      stats.eventsCreated += res.events
    } catch (err) {
      stats.errors.push(`${t.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await prisma.syncState.upsert({
    where: { key: 'titles' },
    create: {
      key: 'titles',
      lastRunAt: new Date(),
      lastSuccess: stats.errors.length === 0 ? new Date() : null,
      lastError: stats.errors[0] ?? null,
    },
    update: {
      lastRunAt: new Date(),
      lastSuccess: stats.errors.length === 0 ? new Date() : undefined,
      lastError: stats.errors[0] ?? null,
    },
  })

  return stats
}

/** Seed the catalogue from whatever the current source offers as trending. */
export async function syncTrending(limit = 20): Promise<SyncStats> {
  const stats: SyncStats = { titlesTouched: 0, eventsCreated: 0, errors: [] }

  for (const t of await catalog().trending({ limit })) {
    try {
      const res = await syncTitle(t.tmdbId, t.mediaType)
      stats.titlesTouched++
      stats.eventsCreated += res.events
    } catch (err) {
      stats.errors.push(`${t.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return stats
}
