/**
 * TMDB catalogue source.
 *
 * Free for non-commercial use. Watch-provider data is supplied by JustWatch
 * and carries an attribution requirement — see the footer component, which
 * must stay wherever availability is displayed.
 */
import {
  type CatalogSource,
  type MediaKind,
  type OfferKind,
  type SourceEpisode,
  type SourceOffer,
  type SourceProvider,
  type SourceSeason,
  type SourceTitle,
  type TitleDetail,
  SourceError,
} from './types'

const BASE = 'https://api.themoviedb.org/3'

/** TMDB's offer buckets, mapped to ours. Order matters for display. */
const OFFER_BUCKETS: Array<[string, OfferKind]> = [
  ['flatrate', 'FLATRATE'],
  ['ads', 'ADS'],
  ['free', 'FREE'],
  ['rent', 'RENT'],
  ['buy', 'BUY'],
]

type TmdbListItem = {
  id: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  popularity?: number
  vote_average?: number
  vote_count?: number
}

export class TmdbSource implements CatalogSource {
  readonly id = 'tmdb'
  readonly isLive = true

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new SourceError('TMDB_API_KEY is empty')
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(BASE + path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const headers: Record<string, string> = { accept: 'application/json' }
    // v4 read-access tokens are JWTs and go in the header; legacy v3 keys
    // are query parameters. Supporting both saves a support question.
    if (this.apiKey.startsWith('eyJ')) {
      headers.authorization = `Bearer ${this.apiKey}`
    } else {
      url.searchParams.set('api_key', this.apiKey)
    }

    const res = await fetch(url, { headers, next: { revalidate: 0 } })
    if (!res.ok) {
      throw new SourceError(`TMDB ${path} failed: ${res.status} ${res.statusText}`, res.status)
    }
    return (await res.json()) as T
  }

  private toTitle(raw: TmdbListItem, fallbackKind?: MediaKind): SourceTitle | null {
    const kind: MediaKind | null =
      raw.media_type === 'movie'
        ? 'MOVIE'
        : raw.media_type === 'tv'
          ? 'TV'
          : (fallbackKind ?? null)

    // /search/multi also returns people, which have no media_type we want.
    if (!kind) return null

    const name = raw.title ?? raw.name
    if (!name) return null

    return {
      tmdbId: raw.id,
      mediaType: kind,
      name,
      originalName: raw.original_title ?? raw.original_name ?? null,
      overview: raw.overview ?? null,
      posterPath: raw.poster_path ?? null,
      backdropPath: raw.backdrop_path ?? null,
      releaseDate: raw.release_date || raw.first_air_date || null,
      popularity: raw.popularity ?? 0,
      voteAverage: raw.vote_average ?? 0,
      voteCount: raw.vote_count ?? 0,
    }
  }

  async search(query: string, opts: { limit?: number } = {}): Promise<SourceTitle[]> {
    if (!query.trim()) return []
    const data = await this.get<{ results: TmdbListItem[] }>('/search/multi', {
      query,
      include_adult: 'false',
    })
    return data.results
      .map((r) => this.toTitle(r))
      .filter((t): t is SourceTitle => t !== null)
      .slice(0, opts.limit ?? 20)
  }

  async trending(opts: { limit?: number } = {}): Promise<SourceTitle[]> {
    const data = await this.get<{ results: TmdbListItem[] }>('/trending/all/week')
    return data.results
      .map((r) => this.toTitle(r))
      .filter((t): t is SourceTitle => t !== null)
      .slice(0, opts.limit ?? 20)
  }

  async getTitle(tmdbId: number, mediaType: MediaKind): Promise<TitleDetail | null> {
    const segment = mediaType === 'MOVIE' ? 'movie' : 'tv'

    type Detail = TmdbListItem & {
      status?: string
      genres?: Array<{ id: number; name: string }>
      belongs_to_collection?: { id: number; name: string; poster_path?: string | null } | null
      seasons?: Array<{
        season_number: number
        name?: string
        overview?: string
        poster_path?: string | null
        air_date?: string | null
        episode_count?: number
      }>
      external_ids?: { tvdb_id?: number | null; imdb_id?: string | null }
    }

    let detail: Detail
    try {
      detail = await this.get<Detail>(`/${segment}/${tmdbId}`, {
        append_to_response: 'external_ids',
      })
    } catch (err) {
      if (err instanceof SourceError && err.status === 404) return null
      throw err
    }

    const base = this.toTitle(detail, mediaType)
    if (!base) return null

    const title: SourceTitle = {
      ...base,
      status: detail.status ?? null,
      genres: (detail.genres ?? []).map((g) => g.name),
      collection: detail.belongs_to_collection
        ? {
            tmdbId: detail.belongs_to_collection.id,
            name: detail.belongs_to_collection.name,
            posterPath: detail.belongs_to_collection.poster_path ?? null,
          }
        : null,
    }

    const seasons: SourceSeason[] = (detail.seasons ?? []).map((s) => ({
      seasonNumber: s.season_number,
      name: s.name ?? null,
      overview: s.overview ?? null,
      posterPath: s.poster_path ?? null,
      airDate: s.air_date ?? null,
      episodeCount: s.episode_count ?? 0,
    }))

    // Episodes come from the latest season only. Backfilling every season of
    // a long-running show costs a request per season and buys nothing: we
    // only ever alert on what has not aired yet.
    const episodes: SourceEpisode[] = []
    if (mediaType === 'TV' && seasons.length > 0) {
      const latest = seasons[seasons.length - 1]
      try {
        const season = await this.get<{
          episodes?: Array<{
            season_number: number
            episode_number: number
            name?: string
            overview?: string
            air_date?: string | null
            runtime?: number | null
          }>
        }>(`/tv/${tmdbId}/season/${latest.seasonNumber}`)
        for (const ep of season.episodes ?? []) {
          episodes.push({
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            name: ep.name ?? null,
            overview: ep.overview ?? null,
            airDate: ep.air_date ?? null,
            runtime: ep.runtime ?? null,
          })
        }
      } catch {
        // A missing season listing should not fail the whole title.
      }
    }

    const collectionEntries: SourceTitle[] = []
    if (title.collection) {
      try {
        const col = await this.get<{ parts?: TmdbListItem[] }>(
          `/collection/${title.collection.tmdbId}`,
        )
        for (const part of col.parts ?? []) {
          const entry = this.toTitle(part, 'MOVIE')
          if (entry) collectionEntries.push(entry)
        }
      } catch {
        // Same: a broken collection should not sink the title.
      }
    }

    return { title, seasons, episodes, collectionEntries }
  }

  async getOffers(tmdbId: number, mediaType: MediaKind, region: string): Promise<SourceOffer[]> {
    const segment = mediaType === 'MOVIE' ? 'movie' : 'tv'
    type ProviderEntry = {
      provider_id: number
      provider_name: string
      logo_path?: string | null
      display_priority?: number
    }

    const data = await this.get<{
      results?: Record<string, Partial<Record<string, ProviderEntry[]>>>
    }>(`/${segment}/${tmdbId}/watch/providers`)

    const forRegion = data.results?.[region.toUpperCase()]
    if (!forRegion) return []

    const offers: SourceOffer[] = []
    for (const [bucket, kind] of OFFER_BUCKETS) {
      for (const entry of forRegion[bucket] ?? []) {
        offers.push({
          providerId: entry.provider_id,
          providerName: entry.provider_name,
          logoPath: entry.logo_path ?? null,
          displayPriority: entry.display_priority ?? 999,
          offerKind: kind,
        })
      }
    }
    return offers
  }

  async listProviders(region: string): Promise<SourceProvider[]> {
    const data = await this.get<{
      results?: Array<{
        provider_id: number
        provider_name: string
        logo_path?: string | null
        display_priority?: number
      }>
    }>('/watch/providers/tv', { watch_region: region.toUpperCase() })

    return (data.results ?? []).map((p) => ({
      providerId: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path ?? null,
      displayPriority: p.display_priority ?? 999,
    }))
  }
}

/** TMDB image CDN. Sizes are fixed buckets; w342 suits our poster grid. */
export function tmdbImage(path: string | null | undefined, size = 'w342'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}
