/**
 * Fixture implementation of CatalogSource.
 *
 * Lets the entire app — pages, sync job, detection engine, notification
 * dispatch — run end to end with no API keys. `isLive` is false so the UI
 * can say plainly that it is showing sample data rather than pretending.
 */
import {
  FIXTURE_CATALOG,
  FIXTURE_PROVIDERS,
  fixtureDetail,
} from './fixtures/catalog'
import type {
  CatalogSource,
  MediaKind,
  SourceOffer,
  SourceProvider,
  SourceTitle,
  TitleDetail,
} from './types'

const providerById = new Map(FIXTURE_PROVIDERS.map((p) => [p.providerId, p]))

function findEntry(tmdbId: number, mediaType: MediaKind) {
  return FIXTURE_CATALOG.find(
    (e) => e.title.tmdbId === tmdbId && e.title.mediaType === mediaType,
  )
}

export class FixtureSource implements CatalogSource {
  readonly id = 'fixtures'
  readonly isLive = false

  async search(query: string, opts: { limit?: number } = {}): Promise<SourceTitle[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return FIXTURE_CATALOG.map((e) => e.title)
      .filter((t) => t.name.toLowerCase().includes(q))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, opts.limit ?? 20)
  }

  async trending(opts: { limit?: number } = {}): Promise<SourceTitle[]> {
    return FIXTURE_CATALOG.map((e) => e.title)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, opts.limit ?? 20)
  }

  async getTitle(tmdbId: number, mediaType: MediaKind): Promise<TitleDetail | null> {
    const entry = findEntry(tmdbId, mediaType)
    return entry ? fixtureDetail(entry) : null
  }

  async getOffers(tmdbId: number, mediaType: MediaKind): Promise<SourceOffer[]> {
    const entry = findEntry(tmdbId, mediaType)
    if (!entry?.offers) return []
    return entry.offers.flatMap((o) => {
      const p = providerById.get(o.providerId)
      if (!p) return []
      return [
        {
          providerId: p.providerId,
          providerName: p.name,
          logoPath: p.logoPath,
          displayPriority: p.displayPriority,
          offerKind: o.kind,
        },
      ]
    })
  }

  async listProviders(): Promise<SourceProvider[]> {
    return FIXTURE_PROVIDERS
  }
}
