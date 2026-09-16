import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import {
  FREE_RATING_LIMIT,
  SUGGESTION_INTERVAL,
  currentSuggestion,
  getEntitlement,
  getTasteProfile,
  nextToRate,
  recommend,
} from '@/lib/taste'
import { SiteHeader } from '@/components/site-header'
import { TasteDeck } from '@/components/taste-deck'
import { PosterArt } from '@/components/poster-art'
import { resetRatings } from '@/app/actions/taste'
import { TitleSheet } from '@/components/title-sheet'
import { sheetBase, sheetHref } from '@/lib/sheet'

export const metadata = { title: "Can't find a good movie to watch?" }

export default async function TastePage({ searchParams }: PageProps<'/taste'>) {
  const user = await getSessionUser()
  if (!user) redirect('/welcome?next=/taste')

  const params = await searchParams
  const view = typeof params.view === 'string' ? params.view : null
  const openTitle = typeof params.title === 'string' ? params.title : null
  const base = sheetBase('/taste', params)

  const [profile, entitlement] = await Promise.all([
    getTasteProfile(user.id),
    getEntitlement(user.id),
  ])

  // First visit: say what is about to happen before it happens.
  if (profile.rated === 0 && view !== 'rate') {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-12">
          <div className="mx-auto max-w-[620px]">
            <div className="readout">Taste calibration</div>
            <h1 className="display mt-5 text-[clamp(2rem,5vw,3rem)]">
              Can&apos;t find a good movie to watch?
            </h1>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-dim">
              We are going to show you one film at a time. For each one, say whether you
              loved it, liked it, disliked it, hated it, or have not seen it.
            </p>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-dim">
              You get {FREE_RATING_LIMIT} free ratings, and a suggestion after every{' '}
              {SUGGESTION_INTERVAL} — three in total. Saying you have not seen something is
              free and does not count against them; it still helps, because it tells us where
              to stop asking.
            </p>

            <div className="panel mt-7 p-5">
              <div className="readout">What you get</div>
              <ul className="mt-3 flex flex-col gap-2.5 text-[14px] text-ink-dim">
                <li className="flex gap-2.5">
                  <span className="text-signal">—</span>
                  Films picked from what you actually rated, not what you once said you liked.
                </li>
                <li className="flex gap-2.5">
                  <span className="text-signal">—</span>
                  Each one says why it is there, so you can disagree with the reasoning.
                </li>
                <li className="flex gap-2.5">
                  <span className="text-signal">—</span>
                  Where it is streaming, and whether that is included with a service you pay for.
                </li>
              </ul>
            </div>

            <p className="mt-5 text-[12.5px] text-ink-faint">
              Films only for now. Television has a different shape — you can love four
              seasons and hate the fifth, and one verdict cannot carry that.
            </p>

            <Link
              href="/taste?view=rate"
              className="mt-7 inline-block rounded-[4px] bg-signal px-6 py-3 text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd]"
            >
              Start rating
            </Link>
          </div>
        </main>
      </>
    )
  }

  if (view === 'results' || (entitlement.locked && view !== 'rate')) {
    const picks = await recommend(user.id, 12)

    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="readout">Based on {profile.counted} verdicts</div>
              <h1 className="display mt-3 text-[1.8rem]">Watch this</h1>
            </div>
            <div className="flex gap-2">
              <Link
                href="/taste?view=rate"
                className="rounded-[4px] border border-line-lit px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-dim hover:border-signal-deep hover:text-signal"
              >
                Rate more
              </Link>
              <form action={resetRatings}>
                <button
                  type="submit"
                  className="rounded-[4px] border border-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint hover:border-live/40 hover:text-live"
                >
                  Start over
                </button>
              </form>
            </div>
          </div>

          {profile.genres.size > 0 ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {[...profile.genres.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([genre, weight]) => (
                  <span
                    key={genre}
                    className={`rounded-[3px] border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                      weight > 0.1
                        ? 'border-signal-deep glow-signal text-signal'
                        : weight < -0.1
                          ? 'border-live/35 glow-live text-live'
                          : 'border-line text-ink-faint'
                    }`}
                  >
                    {genre} {weight > 0 ? '+' : ''}
                    {(weight * 100).toFixed(0)}
                  </span>
                ))}
            </div>
          ) : null}

          {picks.length === 0 ? (
            <p className="text-[14.5px] text-ink-dim">
              Not enough to go on yet. Rate a few films and come back.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {picks.map((pick) => (
                <Link
                  key={pick.id}
                  href={sheetHref(base, pick.id)}
                  scroll={false}
                  className="group flex gap-4 rounded-md border border-line bg-panel p-3 transition-colors hover:border-line-lit"
                >
                  <div className="w-[74px] shrink-0 overflow-hidden rounded-[3px] border border-line">
                    <div className="aspect-[2/3]">
                      <PosterArt name={pick.name} compact />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">{pick.name}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                      {[pick.year, pick.voteAverage.toFixed(1)].filter(Boolean).join(' · ')}
                    </div>
                    <div className="mt-2 text-[12px] leading-snug text-signal">{pick.reason}</div>
                    {pick.availableOn.length > 0 ? (
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                        {pick.availableOn.slice(0, 2).join(' · ')}
                      </div>
                    ) : (
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-live">
                        Not streaming yet
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
        {openTitle ? <TitleSheet titleId={openTitle} closeHref={base} /> : null}
      </>
    )
  }

  const [cards, suggestion] = await Promise.all([
    nextToRate(user.id, 16),
    // Only fetch a suggestion when one is actually due, so we do not burn a
    // recommendation pass on every card.
    profile.counted > 0 && profile.counted % SUGGESTION_INTERVAL === 0
      ? currentSuggestion(user.id)
      : Promise.resolve(null),
  ])

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mx-auto max-w-[760px]">
          <div className="mb-6">
            <div className="readout">Taste calibration</div>
            <h1 className="display mt-3 text-[1.5rem]">
              Can&apos;t find a good movie to watch?
            </h1>
          </div>
          <TasteDeck
            cards={cards}
            counted={entitlement.counted}
            freeLimit={FREE_RATING_LIMIT}
            interval={SUGGESTION_INTERVAL}
            suggestion={suggestion}
            isPro={entitlement.isPro}
          />
        </div>
      </main>
      {openTitle ? <TitleSheet titleId={openTitle} closeHref={base} /> : null}
    </>
  )
}
