/**
 * The catalogue boundary.
 *
 * Netflix, Hulu, Disney+ and Prime Video do not publish usable catalogue
 * APIs, so every fact about what exists and where it streams comes from an
 * aggregator. Everything upstream is hidden behind this interface, which
 * means swapping TMDB for Watchmode later is a new implementation rather
 * than a rewrite — and it lets the whole app run against fixtures with no
 * API keys at all.
 */

export type MediaKind = 'MOVIE' | 'TV'

export type OfferKind = 'FLATRATE' | 'ADS' | 'FREE' | 'RENT' | 'BUY'

export type SourceTitle = {
  tmdbId: number
  mediaType: MediaKind
  name: string
  originalName?: string | null
  overview?: string | null
  posterPath?: string | null
  backdropPath?: string | null
  /** Movies: primary release. TV: first air date. */
  releaseDate?: string | null
  /** TMDB status string: "Returning Series", "Released", "Post Production"… */
  status?: string | null
  popularity?: number
  voteAverage?: number
  voteCount?: number
  /// Genre names. Drives homepage rows and the taste recommender.
  genres?: string[]
  collection?: { tmdbId: number; name: string; posterPath?: string | null } | null
}

export type SourceSeason = {
  seasonNumber: number
  name?: string | null
  overview?: string | null
  posterPath?: string | null
  airDate?: string | null
  episodeCount: number
}

export type SourceEpisode = {
  seasonNumber: number
  episodeNumber: number
  name?: string | null
  overview?: string | null
  /** Date only, from TMDB. */
  airDate?: string | null
  /** Precise instant, from TVmaze. This is what lets us fire at the drop. */
  airstamp?: string | null
  runtime?: number | null
}

export type SourceOffer = {
  providerId: number
  providerName: string
  logoPath?: string | null
  displayPriority?: number
  offerKind: OfferKind
}

export type SourceProvider = {
  providerId: number
  name: string
  logoPath?: string | null
  displayPriority: number
}

export type TitleDetail = {
  title: SourceTitle
  seasons: SourceSeason[]
  episodes: SourceEpisode[]
  /** Other entries in the same franchise. Our only sequel signal. */
  collectionEntries: SourceTitle[]
}

export interface CatalogSource {
  /** Human-readable name, surfaced in sync logs and the admin readout. */
  readonly id: string
  /** False when running on fixtures, so the UI can say so honestly. */
  readonly isLive: boolean

  search(query: string, opts?: { limit?: number }): Promise<SourceTitle[]>
  trending(opts?: { limit?: number }): Promise<SourceTitle[]>
  getTitle(tmdbId: number, mediaType: MediaKind): Promise<TitleDetail | null>
  getOffers(tmdbId: number, mediaType: MediaKind, region: string): Promise<SourceOffer[]>
  listProviders(region: string): Promise<SourceProvider[]>
}

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SourceError'
  }
}
