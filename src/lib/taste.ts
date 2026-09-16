import { prisma } from './db'
import type { RatingValue } from '@/generated/prisma/enums'

/**
 * Taste modelling and film selection.
 *
 * Content-based rather than collaborative, for two reasons. It works from
 * the first rating instead of needing a crowd, and it can explain itself —
 * "because you loved Arrival" is worth more to someone deciding what to
 * watch tonight than a confident number with no reasoning behind it.
 *
 * Films only. Television has a different shape: you can love four seasons
 * and hate the fifth, and one verdict cannot carry that.
 */

/** How much each verdict moves the needle. */
const WEIGHT: Record<RatingValue, number> = {
  LOVED: 2,
  LIKED: 1,
  NOT_SEEN: 0,
  DISLIKED: -1.2,
  // Hate is more informative than love: people are pickier about what they
  // reject, so a hated genre is suppressed harder than a loved one is
  // promoted.
  HATED: -2.5,
}

/** Ratings included free. Only verdicts count — see countedRatings. */
export const FREE_RATING_LIMIT = 15
/** A suggestion every this many counted ratings: 5, 10, 15 = three free. */
export const SUGGESTION_INTERVAL = 5

export type TasteProfile = {
  /** Genre name -> affinity, roughly -1..1. */
  genres: Map<string, number>
  /** Every rating, including "not seen". */
  rated: number
  /** Actual verdicts. This is what the free allowance counts. */
  counted: number
  loved: Array<{ name: string; genres: string[] }>
}

export async function getTasteProfile(userId: string): Promise<TasteProfile> {
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { value: true, title: { select: { name: true, genres: true } } },
  })

  const totals = new Map<string, { score: number; count: number }>()
  const loved: Array<{ name: string; genres: string[] }> = []

  for (const rating of ratings) {
    // "I have not seen this" is recorded because it stops us asking again,
    // but it says nothing about taste and must not skew the model.
    if (rating.value === 'NOT_SEEN') continue
    if (rating.value === 'LOVED') {
      loved.push({ name: rating.title.name, genres: rating.title.genres })
    }

    const weight = WEIGHT[rating.value]
    for (const genre of rating.title.genres) {
      const current = totals.get(genre) ?? { score: 0, count: 0 }
      current.score += weight
      current.count += 1
      totals.set(genre, current)
    }
  }

  const genres = new Map<string, number>()
  for (const [genre, { score, count }] of totals) {
    // Mean rather than sum, so a genre rated once does not outweigh one
    // rated ten times; then damped by sample size so a single verdict is
    // not treated as a settled opinion.
    const mean = score / count
    const confidence = count / (count + 2)
    genres.set(genre, (mean / 2.5) * confidence)
  }

  return {
    genres,
    rated: ratings.length,
    counted: ratings.filter((r) => r.value !== 'NOT_SEEN').length,
    loved,
  }
}

export type Entitlement = {
  counted: number
  remaining: number
  isPro: boolean
  /** True when the free allowance is spent and there is no subscription. */
  locked: boolean
  /** Free suggestions earned so far (one per interval, capped). */
  suggestionsEarned: number
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } }),
    getTasteProfile(userId),
  ])

  const isPro = user?.isPro ?? false
  const remaining = Math.max(0, FREE_RATING_LIMIT - profile.counted)

  return {
    counted: profile.counted,
    remaining,
    isPro,
    locked: !isPro && profile.counted >= FREE_RATING_LIMIT,
    suggestionsEarned: Math.min(
      Math.floor(profile.counted / SUGGESTION_INTERVAL),
      FREE_RATING_LIMIT / SUGGESTION_INTERVAL,
    ),
  }
}

export type Candidate = {
  id: string
  name: string
  year: string | null
  genres: string[]
  voteAverage: number
  popularity: number
}

type PoolItem = Candidate & { voteCount: number }

/**
 * Weighted sample without replacement.
 *
 * Used instead of "take the top N" so the deck is not identical on every
 * visit — two people with the same history should not see the same fifteen
 * films in the same order.
 */
function sampleWeighted<T>(items: Array<{ item: T; weight: number }>, count: number): T[] {
  const pool = items.filter((i) => i.weight > 0).map((i) => ({ ...i }))
  const out: T[] = []

  while (out.length < count && pool.length > 0) {
    const total = pool.reduce((sum, i) => sum + i.weight, 0)
    let target = Math.random() * total
    let index = 0
    for (; index < pool.length - 1; index++) {
      target -= pool[index].weight
      if (target <= 0) break
    }
    out.push(pool[index].item)
    pool.splice(index, 1)
  }

  return out
}

/**
 * How the deck is built.
 *
 * Three buckets, mixed on every request:
 *
 *   Informative (55%) — films whose genres we hold least data on. Each
 *   answer here buys the most, which is how fifteen ratings can say
 *   something useful at all.
 *
 *   Aligned (30%) — films matching what they already appear to like. This
 *   sharpens the boundary of a known preference, and keeps the deck feeling
 *   relevant so people do not abandon it three cards in.
 *
 *   Wildcard (15%) — sampled from the whole pool on reach alone. Without
 *   this the model converges on its own first guess and never recovers; a
 *   horror fan who would love one particular comedy never gets asked. The
 *   randomness is the point, not a concession.
 *
 * Across all three, reach matters: asking about something nobody has seen
 * spends a turn to learn nothing, so widely-seen films are favoured.
 */
export async function nextToRate(userId: string, take = 12): Promise<Candidate[]> {
  const [rated, suggested, profile] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, select: { titleId: true } }),
    prisma.suggestion.findMany({ where: { userId }, select: { titleId: true } }),
    getTasteProfile(userId),
  ])

  const exclude = new Set([...rated.map((r) => r.titleId), ...suggested.map((s) => s.titleId)])

  const pool: PoolItem[] = (
    await prisma.title.findMany({
      where: {
        mediaType: 'MOVIE',
        id: exclude.size > 0 ? { notIn: [...exclude] } : undefined,
        // Unreleased films cannot be rated — nobody has seen them.
        releaseDate: { lte: new Date() },
      },
      orderBy: { popularity: 'desc' },
      take: 240,
      select: {
        id: true, name: true, releaseDate: true, genres: true,
        voteAverage: true, popularity: true, voteCount: true,
      },
    })
  ).map((t) => ({
    id: t.id,
    name: t.name,
    year: t.releaseDate ? String(t.releaseDate.getUTCFullYear()) : null,
    genres: t.genres,
    voteAverage: t.voteAverage,
    popularity: t.popularity,
    voteCount: t.voteCount,
  }))

  if (pool.length === 0) return []

  /** Rough proxy for "you have probably heard of this". */
  const reach = (t: PoolItem) => Math.log10(t.popularity + 10)

  /** Current affinity for a film, averaged over the genres we know. */
  const affinity = (t: PoolItem) => {
    const known = t.genres.map((g) => profile.genres.get(g)).filter((w): w is number => w !== undefined)
    return known.length === 0 ? 0 : known.reduce((a, b) => a + b, 0) / known.length
  }

  const informativeWeights = pool.map((item) => {
    const unknown = item.genres.filter((g) => !profile.genres.has(g)).length
    return { item, weight: (unknown * 2 + 0.4) * reach(item) }
  })

  const alignedWeights = pool.map((item) => {
    const a = affinity(item)
    // Only films the model currently likes; a strongly disliked genre is
    // not a useful place to refine.
    return { item, weight: a > 0 ? (a + 0.05) * 6 * reach(item) : 0 }
  })

  const wildcardWeights = pool.map((item) => {
    const a = affinity(item)
    // Reach only, with a floor under disliked genres rather than a zero, so
    // an unexpected match can still surface.
    const damp = a < 0 ? 0.35 : 1
    return { item, weight: reach(item) * damp }
  })

  const wantInformative = Math.max(1, Math.round(take * 0.55))
  const wantAligned = Math.max(1, Math.round(take * 0.3))
  const wantWildcard = Math.max(1, take - wantInformative - wantAligned)

  const chosen: Candidate[] = []
  const used = new Set<string>()

  const drawFrom = (weights: Array<{ item: PoolItem; weight: number }>, n: number) => {
    const available = weights.filter((w) => !used.has(w.item.id))
    for (const item of sampleWeighted(available, n)) {
      if (used.has(item.id)) continue
      used.add(item.id)
      chosen.push(item)
    }
  }

  drawFrom(informativeWeights, wantInformative)
  drawFrom(alignedWeights, wantAligned)
  drawFrom(wildcardWeights, wantWildcard)

  // Top up from reach alone if a bucket came up short.
  if (chosen.length < take) drawFrom(wildcardWeights, take - chosen.length)

  // Interleave so the deck does not run informative-then-aligned in blocks.
  return chosen.sort(() => Math.random() - 0.5).slice(0, take)
}

export type Recommendation = Candidate & {
  score: number
  reason: string
  availableOn: string[]
}

export async function recommend(userId: string, take = 12): Promise<Recommendation[]> {
  const profile = await getTasteProfile(userId)
  if (profile.counted < 1) return []

  const [rated, dismissed] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, select: { titleId: true } }),
    prisma.suggestion.findMany({
      where: { userId, dismissedAt: { not: null } },
      select: { titleId: true },
    }),
  ])
  const exclude = new Set([...rated.map((r) => r.titleId), ...dismissed.map((d) => d.titleId)])

  const pool = await prisma.title.findMany({
    where: {
      mediaType: 'MOVIE',
      id: exclude.size > 0 ? { notIn: [...exclude] } : undefined,
      releaseDate: { lte: new Date() },
    },
    take: 300,
    select: {
      id: true, name: true, releaseDate: true, genres: true,
      voteAverage: true, popularity: true,
      availability: {
        where: { removedAt: null, offerType: 'FLATRATE' },
        select: { provider: { select: { name: true } } },
      },
    },
  })

  const scored = pool.map((t) => {
    let affinity = 0
    let matched = 0
    for (const genre of t.genres) {
      const weight = profile.genres.get(genre)
      if (weight === undefined) continue
      affinity += weight
      matched++
    }
    // Averaged so a film tagged with five genres does not beat a better
    // match tagged with two.
    const genreScore = matched > 0 ? affinity / matched : 0

    // A small quality prior breaks ties, kept well below the taste signal
    // so it cannot dominate it.
    const quality = (t.voteAverage - 6.5) / 10

    const best = t.genres
      .map((g) => ({ g, w: profile.genres.get(g) ?? 0 }))
      .sort((a, b) => b.w - a.w)[0]

    // Cite a film they loved that actually shares the genre being claimed.
    // One nonsensical explanation costs more trust than a vague one.
    const witness = best ? profile.loved.find((l) => l.genres.includes(best.g)) : undefined

    const reason =
      best && best.w > 0.12
        ? witness
          ? `${best.g} — like ${witness.name}`
          : `Strong ${best.g.toLowerCase()} match`
        : 'Well reviewed and close to your picks'

    return {
      id: t.id,
      name: t.name,
      year: t.releaseDate ? String(t.releaseDate.getUTCFullYear()) : null,
      genres: t.genres,
      voteAverage: t.voteAverage,
      popularity: t.popularity,
      score: genreScore + quality,
      reason,
      availableOn: [...new Set(t.availability.map((a) => a.provider.name))],
    }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, take)
}

/**
 * The single film to show at a milestone.
 *
 * Recorded when shown, so "I have seen that already" can swap it without
 * ever offering the same one twice.
 */
export async function currentSuggestion(userId: string): Promise<Recommendation | null> {
  const profile = await getTasteProfile(userId)
  const milestone = Math.floor(profile.counted / SUGGESTION_INTERVAL)
  if (milestone < 1) return null

  const live = await prisma.suggestion.findFirst({
    where: { userId, dismissedAt: null, atRatingCount: { gt: (milestone - 1) * SUGGESTION_INTERVAL } },
    orderBy: { shownAt: 'desc' },
    select: { titleId: true },
  })

  if (live) {
    const picks = await recommend(userId, 30)
    const existing = picks.find((p) => p.id === live.titleId)
    if (existing) return existing

    // The stored pick fell out of the candidate set (rated since, or no
    // longer eligible); fall through and choose a fresh one.
  }

  const [best] = await recommend(userId, 1)
  if (!best) return null

  await prisma.suggestion.upsert({
    where: { userId_titleId: { userId, titleId: best.id } },
    create: { userId, titleId: best.id, atRatingCount: profile.counted },
    update: { shownAt: new Date(), dismissedAt: null },
  })

  return best
}
