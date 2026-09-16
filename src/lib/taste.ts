import { prisma } from './db'
import type { RatingValue } from '@/generated/prisma/enums'

/**
 * Taste modelling.
 *
 * Content-based rather than collaborative, for two reasons. It works from
 * the first rating instead of needing a crowd, and it can explain itself —
 * "because you loved Arrival and Blade Runner 2049" is worth more to
 * someone deciding what to watch tonight than a confident number.
 *
 * Films only. Television has a different shape: you can love four seasons
 * and hate the fifth, and a single verdict cannot carry that.
 */

/** How much each verdict moves the needle. */
const WEIGHT: Record<RatingValue, number> = {
  LOVED: 2,
  LIKED: 1,
  NOT_SEEN: 0,
  DISLIKED: -1.2,
  // Hate is more informative than love: people are pickier about what they
  // reject, so a hated genre should be suppressed harder than a loved one
  // is promoted.
  HATED: -2.5,
}

export type TasteProfile = {
  /** Genre name -> affinity, roughly -1..1. */
  genres: Map<string, number>
  rated: number
  seen: number
  /// Loved films with their genres, so an explanation can cite one that
  /// actually shares the genre it is claiming.
  loved: Array<{ name: string; genres: string[] }>
}

export async function getTasteProfile(userId: string): Promise<TasteProfile> {
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: {
      value: true,
      title: { select: { name: true, genres: true } },
    },
  })

  const totals = new Map<string, { score: number; count: number }>()
  const loved: Array<{ name: string; genres: string[] }> = []

  for (const rating of ratings) {
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
    // Divide by count so a genre rated once does not outweigh one rated ten
    // times, then damp small samples so a single verdict is not treated as
    // a settled opinion.
    const mean = score / count
    const confidence = count / (count + 2)
    genres.set(genre, (mean / 2.5) * confidence)
  }

  return {
    genres,
    rated: ratings.length,
    seen: ratings.filter((r) => r.value !== 'NOT_SEEN').length,
    loved,
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

/**
 * The next film to ask about.
 *
 * Picks widely-seen films first — there is no point asking about something
 * obscure, since "I have not seen this" teaches us nothing — and prefers
 * genres we know least about, so each card buys the most information.
 */
export async function nextToRate(userId: string, take = 12): Promise<Candidate[]> {
  const [rated, profile] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, select: { titleId: true } }),
    getTasteProfile(userId),
  ])
  const seen = new Set(rated.map((r) => r.titleId))

  const pool = await prisma.title.findMany({
    where: {
      mediaType: 'MOVIE',
      id: { notIn: seen.size > 0 ? [...seen] : undefined },
      voteCount: { gte: 400 },
    },
    orderBy: { popularity: 'desc' },
    take: 80,
    select: {
      id: true, name: true, releaseDate: true, genres: true,
      voteAverage: true, popularity: true,
    },
  })

  // How many verdicts we already hold per genre.
  const known = new Map<string, number>()
  for (const [genre] of profile.genres) known.set(genre, (known.get(genre) ?? 0) + 1)

  const scored = pool.map((t) => {
    const unknownGenres = t.genres.filter((g) => !profile.genres.has(g)).length
    // Popularity is a proxy for "you have probably seen this".
    const reach = Math.log10(t.popularity + 10)
    return { t, score: unknownGenres * 1.6 + reach }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map(({ t }) => ({
      id: t.id,
      name: t.name,
      year: t.releaseDate ? String(t.releaseDate.getUTCFullYear()) : null,
      genres: t.genres,
      voteAverage: t.voteAverage,
      popularity: t.popularity,
    }))
}

export type Recommendation = Candidate & {
  score: number
  reason: string
  availableOn: string[]
}

/** Enough verdicts to say something useful rather than something random. */
export const MIN_RATINGS = 8

export async function recommend(userId: string, take = 12): Promise<Recommendation[]> {
  const profile = await getTasteProfile(userId)
  if (profile.seen < 1) return []

  const rated = await prisma.rating.findMany({ where: { userId }, select: { titleId: true } })
  const seen = new Set(rated.map((r) => r.titleId))

  const pool = await prisma.title.findMany({
    where: {
      mediaType: 'MOVIE',
      id: { notIn: seen.size > 0 ? [...seen] : undefined },
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
    // Average rather than sum, so a film tagged with five genres does not
    // beat a better match tagged with two.
    const genreScore = matched > 0 ? affinity / matched : 0

    // A small quality prior breaks ties between equally-matched films, but
    // stays well below the taste signal so it cannot dominate it.
    const quality = (t.voteAverage - 6.5) / 10

    const best = t.genres
      .map((g) => ({ g, w: profile.genres.get(g) ?? 0 }))
      .sort((a, b) => b.w - a.w)[0]

    // Cite a film they loved that actually shares the genre being claimed.
    // "History — like Into the Spider-Verse" reads as broken, and one bad
    // explanation costs more trust than a vague one.
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
