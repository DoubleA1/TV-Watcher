/**
 * Sample catalogue.
 *
 * Real titles, invented everything else. Statuses, air dates, offers, prices
 * and follower counts here are made up so the site has something to render
 * before TMDB credentials exist. Nothing in this file should be read as a
 * claim about a real release schedule.
 *
 * Dates are computed relative to now, so the demo never goes stale.
 */
import type { SourceEpisode, SourceProvider, SourceTitle, TitleDetail } from '../types'

export const FIXTURE_REGION = 'US'

/**
 * TMDB watch-provider ids. These are the widely-used values; the real
 * directory replaces them wholesale on the first live sync, so a wrong id
 * here is self-correcting rather than load-bearing.
 */
export const FIXTURE_PROVIDERS: SourceProvider[] = [
  { providerId: 8, name: 'Netflix', logoPath: null, displayPriority: 0 },
  { providerId: 1899, name: 'Max', logoPath: null, displayPriority: 1 },
  { providerId: 15, name: 'Hulu', logoPath: null, displayPriority: 2 },
  { providerId: 337, name: 'Disney+', logoPath: null, displayPriority: 3 },
  { providerId: 9, name: 'Prime Video', logoPath: null, displayPriority: 4 },
  { providerId: 350, name: 'Apple TV+', logoPath: null, displayPriority: 5 },
  { providerId: 386, name: 'Peacock', logoPath: null, displayPriority: 6 },
  { providerId: 531, name: 'Paramount+', logoPath: null, displayPriority: 7 },
]

const DAY = 86_400_000

function at(daysFromNow: number, hour = 0, minute = 0): Date {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return new Date(d.getTime() + daysFromNow * DAY)
}

/** Next occurrence of a weekday (0=Sun). Always in the future. */
function nextWeekday(day: number, hour = 0): Date {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  let delta = (day - d.getDay() + 7) % 7
  if (delta === 0) delta = 7
  d.setDate(d.getDate() + delta)
  return d
}

const iso = (d: Date) => d.toISOString()
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

type FixtureEntry = {
  title: SourceTitle
  seasons?: Array<{ seasonNumber: number; airDate: Date | null; episodeCount: number }>
  episodes?: SourceEpisode[]
  /** providerId -> offer kind. */
  offers?: Array<{ providerId: number; kind: 'FLATRATE' | 'RENT' | 'BUY' | 'ADS' | 'FREE' }>
  collectionEntries?: SourceTitle[]
}

function tv(
  tmdbId: number,
  name: string,
  year: string,
  status: string,
  popularity: number,
): SourceTitle {
  return {
    tmdbId,
    mediaType: 'TV',
    name,
    overview: null,
    posterPath: null,
    releaseDate: `${year}-01-01`,
    status,
    popularity,
    voteAverage: 8 + (tmdbId % 15) / 10,
    voteCount: 900 + (tmdbId % 400) * 7,
  }
}

function film(
  tmdbId: number,
  name: string,
  year: string,
  status: string,
  popularity: number,
  collection?: { tmdbId: number; name: string },
): SourceTitle {
  return {
    tmdbId,
    mediaType: 'MOVIE',
    name,
    overview: null,
    posterPath: null,
    releaseDate: `${year}-01-01`,
    status,
    popularity,
    voteAverage: 7.4 + (tmdbId % 20) / 10,
    voteCount: 1200 + (tmdbId % 500) * 5,
    collection: collection ? { ...collection, posterPath: null } : null,
  }
}

const DUNE_COLLECTION = { tmdbId: 726871, name: 'Dune Collection' }

/** Weekly episodes for a season starting on the given day. */
function weekly(season: number, count: number, first: Date, titlePrefix = 'Episode'): SourceEpisode[] {
  return Array.from({ length: count }, (_, i) => {
    const when = new Date(first.getTime() + i * 7 * DAY)
    return {
      seasonNumber: season,
      episodeNumber: i + 1,
      name: `${titlePrefix} ${i + 1}`,
      overview: null,
      airDate: dateOnly(when),
      airstamp: iso(when),
      runtime: 48,
    }
  })
}

export const FIXTURE_CATALOG: FixtureEntry[] = [
  {
    title: tv(95396, 'Severance', '2022', 'Returning Series', 412),
    seasons: [
      { seasonNumber: 1, airDate: at(-1200), episodeCount: 9 },
      { seasonNumber: 2, airDate: at(-400), episodeCount: 10 },
      { seasonNumber: 3, airDate: nextWeekday(5), episodeCount: 10 },
    ],
    episodes: weekly(3, 10, nextWeekday(5)),
    offers: [
      { providerId: 350, kind: 'FLATRATE' },
      { providerId: 9, kind: 'RENT' },
    ],
  },
  {
    title: tv(136315, 'The Bear', '2022', 'Returning Series', 355),
    seasons: [{ seasonNumber: 5, airDate: nextWeekday(5), episodeCount: 10 }],
    episodes: weekly(5, 10, nextWeekday(5)),
    offers: [{ providerId: 15, kind: 'FLATRATE' }],
  },
  {
    title: tv(106379, 'Fallout', '2024', 'Returning Series', 298),
    seasons: [{ seasonNumber: 2, airDate: at(-14), episodeCount: 8 }],
    episodes: weekly(2, 8, at(-14, 0, 1)),
    offers: [{ providerId: 9, kind: 'FLATRATE' }],
  },
  {
    title: tv(125988, 'Silo', '2023', 'Returning Series', 244),
    seasons: [{ seasonNumber: 3, airDate: at(26), episodeCount: 10 }],
    episodes: weekly(3, 10, at(26)),
    offers: [{ providerId: 350, kind: 'FLATRATE' }],
  },
  {
    title: tv(100088, 'The Last of Us', '2023', 'Returning Series', 331),
    seasons: [{ seasonNumber: 3, airDate: at(180), episodeCount: 9 }],
    episodes: weekly(3, 9, at(180)),
    offers: [{ providerId: 1899, kind: 'FLATRATE' }],
  },
  {
    title: tv(94605, 'Arcane', '2021', 'Ended', 210),
    offers: [{ providerId: 8, kind: 'FLATRATE' }],
  },
  {
    title: tv(83867, 'Andor', '2022', 'Ended', 265),
    offers: [{ providerId: 337, kind: 'FLATRATE' }],
  },
  {
    title: tv(94997, 'House of the Dragon', '2022', 'Returning Series', 289),
    seasons: [{ seasonNumber: 3, airDate: at(240), episodeCount: 8 }],
    offers: [{ providerId: 1899, kind: 'FLATRATE' }],
  },
  {
    title: tv(127532, 'Shogun', '2024', 'Returning Series', 232),
    seasons: [{ seasonNumber: 2, airDate: at(300), episodeCount: 10 }],
    offers: [{ providerId: 15, kind: 'FLATRATE' }],
  },
  {
    title: tv(93740, 'Foundation', '2021', 'Returning Series', 198),
    seasons: [{ seasonNumber: 4, airDate: at(120), episodeCount: 10 }],
    offers: [{ providerId: 350, kind: 'FLATRATE' }],
  },
  {
    title: film(693134, 'Dune: Part Two', '2024', 'Released', 320, DUNE_COLLECTION),
    offers: [
      { providerId: 1899, kind: 'FLATRATE' },
      { providerId: 9, kind: 'RENT' },
    ],
    collectionEntries: [
      film(438631, 'Dune', '2021', 'Released', 280, DUNE_COLLECTION),
      film(1155089, 'Dune: Part Three', '2027', 'Post Production', 190, DUNE_COLLECTION),
    ],
  },
  {
    title: film(438631, 'Dune', '2021', 'Released', 280, DUNE_COLLECTION),
    offers: [{ providerId: 1899, kind: 'FLATRATE' }],
  },
  {
    // The "saw the trailer, never streamed anywhere" case.
    title: film(1155089, 'Dune: Part Three', '2027', 'Post Production', 190, DUNE_COLLECTION),
    offers: [],
  },
  {
    title: film(792307, 'Poor Things', '2023', 'Released', 176),
    offers: [{ providerId: 1899, kind: 'FLATRATE' }],
  },
  {
    title: film(872585, 'Oppenheimer', '2023', 'Released', 240),
    offers: [
      { providerId: 386, kind: 'FLATRATE' },
      { providerId: 9, kind: 'BUY' },
    ],
  },
  {
    title: film(335984, 'Blade Runner 2049', '2017', 'Released', 165),
    offers: [
      { providerId: 8, kind: 'FLATRATE' },
      { providerId: 9, kind: 'RENT' },
    ],
  },
]

export function fixtureDetail(entry: FixtureEntry): TitleDetail {
  return {
    title: entry.title,
    seasons: (entry.seasons ?? []).map((s) => ({
      seasonNumber: s.seasonNumber,
      name: `Season ${s.seasonNumber}`,
      overview: null,
      posterPath: null,
      airDate: s.airDate ? dateOnly(s.airDate) : null,
      episodeCount: s.episodeCount,
    })),
    episodes: entry.episodes ?? [],
    collectionEntries: entry.collectionEntries ?? [],
  }
}
