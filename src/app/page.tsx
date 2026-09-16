import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCommunityTrending } from '@/lib/queries'
import { getSessionUser } from '@/lib/auth/session'
import { SiteHeader } from '@/components/site-header'
import { TitlePlate } from '@/components/title-plate'
import { Countdown } from '@/components/countdown'
import { SIGNALS } from '@/components/signals'

export default async function HomePage() {
  const [trending, user, next] = await Promise.all([
    getCommunityTrending(12),
    getSessionUser(),
    // The hero clock counts down to a real armed event, not a placeholder.
    prisma.releaseEvent.findFirst({
      where: { occursAt: { gt: new Date() }, eventType: { in: ['SEASON_PREMIERE', 'NEW_EPISODE'] } },
      orderBy: { occursAt: 'asc' },
      select: {
        occursAt: true,
        eventType: true,
        payload: true,
        title: {
          select: {
            id: true,
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
        <section className="grid items-center gap-[clamp(28px,5vw,64px)] py-[clamp(24px,5vw,48px)] lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="readout">Release monitoring · United States</div>
            <h1 className="display mt-6 text-[clamp(2.3rem,6.2vw,4.1rem)] font-extrabold tracking-[-0.02em]">
              You already know what you want to watch.{' '}
              <span className="text-signal">We watch for it.</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-[clamp(1rem,1.6vw,1.12rem)] text-ink-dim">
              Follow a show or a film once. When the next season lands, when the sequel gets
              announced, or when it finally turns up on a service you already pay for — your
              phone buzzes. No app to open. No checking.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={user ? '/search' : '/signup'}
                className="rounded-[4px] bg-signal px-5 py-[11px] text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd]"
              >
                {user ? 'Find something to follow' : 'Start tracking'}
              </Link>
              <Link
                href="/search"
                className="rounded-[4px] border border-line-lit px-5 py-[11px] text-sm font-semibold transition-colors hover:border-signal-deep hover:text-signal"
              >
                Browse the catalogue
              </Link>
            </div>
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

              <div className="display text-[1.32rem] font-bold">
                {next.title.name}
                {payload.seasonNumber ? ` — Season ${payload.seasonNumber}` : ''}
              </div>
              <div className="text-[13px] text-ink-dim">
                {[
                  service,
                  payload.seasonNumber && payload.episodeNumber
                    ? `S${String(payload.seasonNumber).padStart(2, '0')}E${String(payload.episodeNumber).padStart(2, '0')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>

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

        <section className="mt-[clamp(40px,6vw,62px)]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
            <h2 className="display text-[1.22rem]">Tracked this week</h2>
            <span className="text-[12.5px] text-ink-faint">What other people started following</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3.5">
            {trending.map((t) => (
              <TitlePlate
                key={t.id}
                title={t}
                tag={t.followers > 0 ? `${t.followers} following` : null}
              />
            ))}
          </div>
        </section>

        <section className="mt-[clamp(40px,6vw,62px)]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
            <h2 className="display text-[1.22rem]">Five different things worth knowing</h2>
            <span className="text-[12.5px] text-ink-faint">Switch each one on per title</span>
          </div>
          <p className="mb-5 max-w-[62ch] text-[14.5px] text-ink-dim">
            Most trackers offer one switch: notify me about this. That gets you ten texts for
            ten episodes of a weekly show, and then you stop reading the texts. These are
            separate on purpose.
          </p>
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

        <footer className="mt-16 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-xs text-ink-faint">
          <span>Streaming availability via TMDB / JustWatch · Episode timing via TVmaze</span>
          <Link href="/search" className="hover:text-ink-dim">Browse everything</Link>
        </footer>
      </main>
    </>
  )
}
