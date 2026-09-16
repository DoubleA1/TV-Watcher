/**
 * TMDB connection check.
 *
 * Exercises every endpoint the app actually depends on and reports what
 * works, so a misconfigured key fails here with a clear message rather than
 * as an empty page three screens deep.
 *
 *   npm run tmdb:check
 */
import 'dotenv/config'

const BASE = 'https://api.themoviedb.org/3'

const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

let failures = 0

function pass(label: string, detail?: string) {
  console.log(`  ${green('OK')}    ${label}${detail ? dim('  ' + detail) : ''}`)
}

function fail(label: string, detail: string) {
  failures++
  console.log(`  ${red('FAIL')}  ${label}\n        ${red(detail)}`)
}

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY!.trim()
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const headers: Record<string, string> = { accept: 'application/json' }
  // v4 read-access tokens are JWTs and go in the header; legacy v3 keys are
  // query parameters. The app supports both, so the check must too.
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

async function main() {
  console.log(bold('\nTMDB connection check\n'))

  // --- 1. is there a key at all -------------------------------------------
  const key = process.env.TMDB_API_KEY?.trim()
  if (!key) {
    console.log(`  ${red('FAIL')}  No TMDB_API_KEY found`)
    console.log(dim('\n        Add it to .env:  TMDB_API_KEY="your-key-here"'))
    console.log(dim('        Get one free at: https://www.themoviedb.org/settings/api\n'))
    console.log(dim('        Without it the app runs on fixtures and shows a'))
    console.log(dim('        "sample data" badge. Nothing breaks — it is just not real.\n'))
    process.exitCode = 1
    return
  }

  const kind = key.startsWith('eyJ') ? 'v4 read access token (Bearer)' : 'v3 API key (query param)'
  pass('Key present', kind)

  // --- 2. does it authenticate --------------------------------------------
  try {
    await call('/configuration')
    pass('Authenticates')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail('Authentication', message)
    if (message.includes('401')) {
      console.log(dim('\n        A 401 means the key is wrong or not yet active.'))
      console.log(dim('        New keys can take a few minutes. Check for stray'))
      console.log(dim('        quotes or whitespace in .env.\n'))
    }
    process.exitCode = 1
    return
  }

  // --- 3. the endpoints the app actually uses ------------------------------
  type ListResponse = { results?: Array<{ id: number; title?: string; name?: string; poster_path?: string | null }> }

  let sampleMovieId = 693134 // Dune: Part Two
  let posterHits = 0
  let posterTotal = 0

  try {
    const data = await call<ListResponse>('/search/multi', { query: 'dune', include_adult: 'false' })
    const hits = data.results ?? []
    pass('Search', `${hits.length} results for "dune"`)
    const first = hits.find((r) => r.title || r.name)
    if (first) sampleMovieId = first.id
  } catch (err) {
    fail('Search', err instanceof Error ? err.message : String(err))
  }

  try {
    const data = await call<ListResponse>('/trending/all/week')
    const hits = data.results ?? []
    posterTotal = hits.length
    posterHits = hits.filter((r) => r.poster_path).length
    pass('Trending', `${hits.length} titles`)
  } catch (err) {
    fail('Trending', err instanceof Error ? err.message : String(err))
  }

  try {
    const detail = await call<{ title?: string; genres?: Array<{ name: string }>; status?: string }>(
      `/movie/${sampleMovieId}`,
      { append_to_response: 'external_ids' },
    )
    pass('Title detail', `${detail.title} · ${(detail.genres ?? []).map((g) => g.name).join(', ')}`)
  } catch (err) {
    fail('Title detail', err instanceof Error ? err.message : String(err))
  }

  try {
    const data = await call<{ results?: Record<string, { flatrate?: Array<{ provider_name: string }> }> }>(
      `/movie/${sampleMovieId}/watch/providers`,
    )
    const us = data.results?.US
    const names = (us?.flatrate ?? []).map((p) => p.provider_name)
    pass('Watch providers', names.length ? `US flatrate: ${names.join(', ')}` : 'US: no flatrate offers')
  } catch (err) {
    fail('Watch providers', err instanceof Error ? err.message : String(err))
  }

  try {
    const data = await call<{ results?: unknown[] }>('/watch/providers/tv', { watch_region: 'US' })
    pass('Provider directory', `${(data.results ?? []).length} services in US`)
  } catch (err) {
    fail('Provider directory', err instanceof Error ? err.message : String(err))
  }

  // --- 4. poster coverage --------------------------------------------------
  if (posterTotal > 0) {
    const pct = Math.round((posterHits / posterTotal) * 100)
    console.log(
      `  ${pct === 100 ? green('OK') : dim('INFO')}    Poster coverage${dim(
        `  ${posterHits}/${posterTotal} trending titles have one (${pct}%)`,
      )}`,
    )
    if (pct < 100) {
      console.log(dim('        The rest fall back to generated art — by design.'))
    }
  }

  // --- verdict -------------------------------------------------------------
  if (failures === 0) {
    console.log(green(bold('\n  All good.\n')))
    console.log('  Next:')
    console.log(dim('    npm run db:seed      # re-ingest, now from TMDB'))
    console.log(dim('    npm run dev          # the "sample data" badge should be gone\n'))
    console.log(dim('  Attribution: watch-provider data is JustWatch\'s and must be'))
    console.log(dim('  credited wherever availability is shown. The footer does this.\n'))
  } else {
    console.log(red(bold(`\n  ${failures} check${failures === 1 ? '' : 's'} failed.\n`)))
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
