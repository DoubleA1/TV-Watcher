import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { getTitlePage, OFFER_LABEL } from '@/lib/queries'
import { tmdbImage } from '@/lib/providers'
import { PosterArt } from '@/components/poster-art'
import { AlertSwitches } from '@/components/alert-switches'
import { FollowButton } from '@/components/follow-button'
import { SheetShell } from '@/components/sheet-shell'

/**
 * Title detail, rendered as an overlay rather than its own page.
 *
 * Keeping it a sheet means browsing never loses your place in a rail, and
 * the ?title= parameter keeps it linkable and server-rendered — the URL is
 * still the state, it just does not cost a separate page.
 */
export async function TitleSheet({
  titleId,
  closeHref,
}: {
  titleId: string
  closeHref: string
}) {
  const user = await getSessionUser()
  const data = await getTitlePage(titleId, user?.id ?? null)
  if (!data) return null

  const { title, offers, follow, nextEvent } = data
  const poster = tmdbImage(title.posterPath, 'w500')

  const included = offers.filter((o) => o.offerType === 'FLATRATE')
  const paid = offers.filter((o) => o.offerType === 'RENT' || o.offerType === 'BUY')
  const onYours = included.find((o) => o.subscribed)

  return (
    <SheetShell closeHref={closeHref}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-[clamp(18px,3vw,28px)] py-4">
        <div className="min-w-0">
          <div className="readout">
            {[title.mediaType === 'TV' ? 'Series' : 'Film', title.year, title.status]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <h2 className="display mt-2 text-[clamp(1.4rem,3.4vw,1.9rem)]">{title.name}</h2>
        </div>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Close"
          className="shrink-0 rounded-[4px] border border-line px-2.5 py-1.5 font-mono text-[11px] text-ink-faint transition-colors hover:border-line-lit hover:text-ink"
        >
          ✕
        </Link>
      </div>

      <div className="grid gap-[clamp(18px,3vw,28px)] px-[clamp(18px,3vw,28px)] py-[clamp(18px,3vw,26px)] sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="mx-auto w-[130px] sm:mx-0 sm:w-full">
          <div className="aspect-[2/3] overflow-hidden rounded-[4px] border border-line">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="h-full w-full object-cover" />
            ) : (
              <PosterArt name={title.name} />
            )}
          </div>

          <div className="mt-3">
            {user ? (
              <FollowButton titleId={title.id} following={Boolean(follow)} />
            ) : (
              <Link
                href="/welcome"
                className="block rounded-[4px] bg-signal px-4 py-2.5 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#04120f] hover:bg-[#63ecdd]"
              >
                Sign up to follow
              </Link>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="grid gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-3">
            <Stat
              label="Next up"
              value={
                nextEvent
                  ? new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: user?.timezone ?? 'America/Los_Angeles',
                    }).format(nextEvent.occursAt)
                  : 'Nothing scheduled'
              }
              tone={nextEvent ? 'live' : undefined}
            />
            <Stat
              label="Streaming"
              value={title.hasEverStreamed ? 'Yes' : 'Not yet'}
              tone={title.hasEverStreamed ? undefined : 'live'}
            />
            <Stat label="Following" value={String(title.followers)} />
          </div>

          <div className="readout mb-2.5 mt-5">Where it streams</div>
          {offers.length === 0 ? (
            <div className="rounded-[4px] border border-line bg-panel-2 px-3.5 py-3 text-[13.5px] text-ink-dim">
              Not streaming anywhere yet. Follow it and you will hear the moment that changes.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...included, ...paid].map((offer) => (
                <div
                  key={`${offer.providerId}-${offer.offerType}`}
                  className="flex items-center gap-3 rounded-[4px] border border-line bg-panel-2 px-3.5 py-2.5"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px] font-display text-[11px] font-extrabold"
                    style={{
                      background: offer.offerType === 'FLATRATE' ? 'var(--color-signal)' : '#5a6b85',
                      color: offer.offerType === 'FLATRATE' ? '#04120f' : 'var(--color-ink)',
                    }}
                  >
                    {offer.providerName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {offer.providerName}
                  </span>
                  {offer.subscribed ? (
                    <span className="whitespace-nowrap rounded-[3px] border border-signal-deep glow-signal px-1.5 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-signal">
                      You have this
                    </span>
                  ) : null}
                  <span
                    className={`whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.08em] ${
                      offer.offerType === 'FLATRATE' ? 'text-signal' : 'text-ink-faint'
                    }`}
                  >
                    {OFFER_LABEL[offer.offerType]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {onYours ? (
            <p className="mt-3 text-[12.5px] text-ink-dim">
              Included with {onYours.providerName}, which you already pay for. Nothing more to
              spend.
            </p>
          ) : null}

          <div className="mt-6 rounded-md border border-line bg-panel-2 p-[clamp(16px,2.5vw,22px)]">
            <div className="readout mb-1.5">Tell me when</div>
            {user && follow ? (
              <AlertSwitches titleId={title.id} rules={follow.alerts} />
            ) : (
              <>
                <p className="max-w-[58ch] py-2 text-[13.5px] text-ink-dim">
                  {user
                    ? 'Follow this title to choose which of the five alerts you want.'
                    : 'Sign up to choose which of the five alerts you want.'}
                </p>
                <div className="pointer-events-none opacity-40">
                  <AlertSwitches titleId={title.id} rules={[]} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </SheetShell>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'live' }) {
  return (
    <div className="bg-panel px-3.5 py-3">
      <div className="readout">{label}</div>
      <div
        className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
          tone === 'live' ? 'text-live' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
