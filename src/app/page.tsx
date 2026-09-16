import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCommunityTrending, searchCatalog } from '@/lib/queries'
import { buildHomeRows } from '@/lib/rows'
import { getSessionUser } from '@/lib/auth/session'
import { sheetBase } from '@/lib/sheet'
import { SiteHeader } from '@/components/site-header'
import { TitlePlate } from '@/components/title-plate'
import { TitleRow } from '@/components/title-row'
import { TitleSheet } from '@/components/title-sheet'
import { Countdown } from '@/components/countdown'
import { SIGNALS } from '@/components/signals'

export default async function DiscoverPage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const openTitle = typeof params.title === 'string' ? params.title : null
  const base = sheetBase('/', params)

  const user = await getSessionUser()

  const [results, trending, rows, next] = await Promise.all([
    q ? searchCatalog(q, 18) : Promise.resolve([]),
    getCommunityTrending(14),
    buildHomeRows(user?.id ?? null),
    prisma.releaseEvent.findFirst({
      where: {
        occursAt: { gt: new Date() },
        eventType: { in: ['SEASON_PREMIERE', 'NEW_EPISODE'] },
      },
      orderBy: { occursAt: 'asc' },
      select: {
        occursAt: true,
        payload: true,
        title: {
          select: {
            name: true,
            availability: {
              where: { removedAt: null, offerType: 'FLATRATE' },
              take: 1,
              select: { provider: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ])

  const payload = (next?.payload ?? {}) as { seasonNumber?: number; episodeNumber?: number }
  const service = next?.title.availability[0]?.provider.name

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24">
        {/* Search lives on Discover rather than on its own page: looking for
            something and browsing for something are the same intent. */}
        <form method="get" className="relative mx-auto mt-6 max-w-[620px]">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="q" className="sr-only">Search shows and films</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search anything — including films that are not out yet"
            className="input-console pl-10"
            autoComplete="off"
          />
        </form>

        {q ? (
          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2.5">
              <h1 className="display text-[1.12rem]">
                {results.length} {results.length === 1 ? 'result' : 'results'} for “{q}”
              </h1>
              <Link href="/" className="text-[12px] text-ink-faint hover:text-signal">
                Clear search
              </Link>
            </div>
            {results.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3.5">
                {results.map((t) => (
                  <TitlePlate
                    key={t.id}
                    title={t}
                    base={base}
                    tag={t.status === 'Post Production' ? 'Not out yet' : null}
                  />
                ))}
              </div>
            ) : (
              <p className="max-w-[62ch] text-[14.5px] text-ink-dim">
                Nothing matched. Try fewer words, or the original title if it was renamed for
                release.
              </p>
            )}
          </section>
        ) : (
          <>
            <section className="grid items-center gap-[clamp(28px,5vw,64px)] py-[clamp(20px,4vw,44px)] lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="readout">Release monitoring · United States</div>
                <h1 className="display mt-6 text-[clamp(2.1rem,5.6vw,3.7rem)] font-extrabold tracking-[-0.02em]">
                  You already know what you want to watch.{' '}
                  <span className="text-signal">We watch for it.</span>
                </h1>
                <p className="mt-5 max-w-[46ch] text-[clamp(1rem,1.6vw,1.1rem)] text-ink-dim">
                  Follow a show or a film once. When the next season lands, when the sequel gets
                  announced, or when it finally turns up on a service you already pay for — your
                  phone buzzes.
                </p>
                {!user ? (
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/welcome"
                      className="rounded-[4px] bg-signal px-5 py-[11px] text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd]"
                    >
                      Start tracking
                    </Link>
                    <Link
                      href="/taste"
                      className="rounded-[4px] border border-line-lit px-5 py-[11px] text-sm font-semibold transition-colors hover:border-signal-deep hover:text-signal"
                    >
                      Find me a film
                    </Link>
                  </div>
                ) : null}
              </div>

              {next ? (
                <div
                  className="rounded-md border border-line p-5"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(69,224,208,0.055), transparent 58%), var(--color-panel)',
                  }}
                >
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3.5">
                    <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.15em] text-signal">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                      Armed
                    </span>
                    <span className="readout">Next drop</span>
                  </div>
                  <div className="display text-[1.32rem]">
                    {next.title.name}
                    {payload.seasonNumber ? ` — Season ${payload.seasonNumber}` : ''}
                  </div>
                  <div className="text-[13px] text-ink-dim">{service}</div>
                  <Countdown target={next.occursAt.toISOString()} />
                  <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 text-[12.5px] text-ink-dim">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-signal" aria-hidden="true">
                      <path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                    Text goes out the second it unlocks — not the next morning.
                  </div>
                </div>
              ) : null}
            </section>

            <section className="mt-[clamp(28px,4vw,44px)]">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2.5">
                <h2 className="display text-[1.12rem]">Tracked this week</h2>
                <span className="text-[12px] text-ink-faint">What other people started following</span>
              </div>
              <div
                className="-mx-[var(--gutter)] flex gap-3.5 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:thin]"
                style={{ scrollSnapType: 'x proximity' }}
              >
                {trending.map((t) => (
                  <div key={t.id} className="w-[132px] shrink-0" style={{ scrollSnapAlign: 'start' }}>
                    <TitlePlate
                      title={t}
                      base={base}
                      tag={t.followers > 0 ? `${t.followers} following` : null}
                    />
                  </div>
                ))}
              </div>
            </section>

            {rows.map((row) => (
              <TitleRow key={row.key} row={row} base={base} />
            ))}

            <section className="panel mt-[clamp(40px,6vw,62px)] p-[clamp(20px,4vw,32px)]">
              <div className="readout">Cannot decide?</div>
              <h2 className="display mt-3 text-[1.5rem]">
                Rate a few films and we will find you one.
              </h2>
              <p className="mt-3 max-w-[58ch] text-[14.5px] text-ink-dim">
                A handful of quick verdicts is usually enough to work out what you actually
                like, rather than what you once said you liked.
              </p>
              <Link
                href="/taste"
                className="mt-5 inline-block rounded-[4px] bg-signal px-5 py-[11px] text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd]"
              >
                Find me something to watch
              </Link>
            </section>

            <section className="mt-[clamp(40px,6vw,62px)]">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
                <h2 className="display text-[1.22rem]">Five different things worth knowing</h2>
                <span className="text-[12.5px] text-ink-faint">Switch each on per title</span>
              </div>
              <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                {SIGNALS.map((s) => (
                  <div key={s.type} className="flex flex-col gap-2 bg-panel p-5">
                    <span className="text-signal">{s.icon}</span>
                    <h3 className="display text-[0.97rem] font-semibold">{s.label}</h3>
                    <p className="text-[13px] leading-relaxed text-ink-dim">{s.blurb}</p>
                    {s.optIn ? (
                      <span className="mt-0.5 self-start rounded-[3px] border border-line px-1.5 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">
                        Off by default
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="mt-16 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-xs text-ink-faint">
          <span>Streaming availability via TMDB / JustWatch · Episode timing via TVmaze</span>
        </footer>
      </main>

      {openTitle ? <TitleSheet titleId={openTitle} closeHref={base} /> : null}
    </>
  )
}
