/**
 * TVmaze — free, keyless, and the only source here with a precise instant
 * for each episode.
 *
 * TMDB gives an air *date*; TVmaze gives `airstamp`, an ISO timestamp with a
 * timezone. That difference is the whole "we text you the moment it drops"
 * claim, so TV titles get matched to TVmaze wherever possible and fall back
 * to midnight-local only when no match exists.
 *
 * Rate limit is roughly 20 calls per 10 seconds per IP, so callers should
 * stay sequential rather than fanning out.
 */
import { type SourceEpisode, SourceError } from './types'

const BASE = 'https://api.tvmaze.com'

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(BASE + path, {
    headers: { accept: 'application/json' },
    next: { revalidate: 0 },
  })
  // TVmaze answers 404 for "no match", which is an expected outcome here
  // rather than a failure.
  if (res.status === 404) return null
  if (!res.ok) {
    throw new SourceError(`TVmaze ${path} failed: ${res.status} ${res.statusText}`, res.status)
  }
  return (await res.json()) as T
}

type MazeShow = { id: number; name: string; premiered?: string | null }

/**
 * Find a TVmaze show id. Prefers the TheTVDB id carried in TMDB's
 * external_ids, because name search is ambiguous for remakes and reboots.
 */
export async function matchShow(opts: {
  tvdbId?: number | null
  imdbId?: string | null
  name?: string
}): Promise<number | null> {
  if (opts.tvdbId) {
    const byTvdb = await get<MazeShow>(`/lookup/shows?thetvdb=${opts.tvdbId}`)
    if (byTvdb) return byTvdb.id
  }
  if (opts.imdbId) {
    const byImdb = await get<MazeShow>(`/lookup/shows?imdb=${encodeURIComponent(opts.imdbId)}`)
    if (byImdb) return byImdb.id
  }
  if (opts.name) {
    const byName = await get<MazeShow>(`/singlesearch/shows?q=${encodeURIComponent(opts.name)}`)
    if (byName) return byName.id
  }
  return null
}

type MazeEpisode = {
  season: number
  number: number | null
  name?: string
  summary?: string | null
  airdate?: string | null
  airstamp?: string | null
  runtime?: number | null
}

export async function getEpisodes(showId: number): Promise<SourceEpisode[]> {
  const eps = await get<MazeEpisode[]>(`/shows/${showId}/episodes`)
  if (!eps) return []

  return eps
    // Specials come through with a null number and would collide on our
    // (title, season, episode) key.
    .filter((e) => e.number !== null)
    .map((e) => ({
      seasonNumber: e.season,
      episodeNumber: e.number as number,
      name: e.name ?? null,
      overview: e.summary ? stripTags(e.summary) : null,
      airDate: e.airdate || null,
      airstamp: e.airstamp || null,
      runtime: e.runtime ?? null,
    }))
}

/** TVmaze summaries arrive as small HTML fragments. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
