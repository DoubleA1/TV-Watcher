import { FixtureSource } from './fixture-source'
import { TmdbSource } from './tmdb'
import type { CatalogSource } from './types'

export * from './types'
export { tmdbImage } from './tmdb'

let cached: CatalogSource | null = null

/**
 * The catalogue source for this process.
 *
 * TMDB when a key is configured, fixtures otherwise. Falling back rather
 * than throwing is deliberate: a missing key should leave you with a
 * browsable site and an honest "sample data" banner, not a stack trace.
 */
export function catalog(): CatalogSource {
  if (cached) return cached

  const key = process.env.TMDB_API_KEY?.trim()
  if (key) {
    cached = new TmdbSource(key)
  } else {
    cached = new FixtureSource()
  }
  return cached
}

/** True when the data on screen came from a real upstream API. */
export function isLiveData(): boolean {
  return catalog().isLive
}
