import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getTitlePage, OFFER_LABEL } from '@/lib/queries'
import { posterPlate } from '@/lib/poster'
import { tmdbImage } from '@/lib/providers'
import { SiteHeader } from '@/components/site-header'
import { AlertSwitches } from '@/components/alert-switches'
import { FollowButton } from '@/components/follow-button'

export default async function TitlePage({ params }: PageProps<'/title/[id]'>) {
  const { id } = await params
  const user = await getSessionUser()
  const data = await getTitlePage(id, user?.id ?? null)
  if (!data) notFound()

  const { title, offers, follow, nextEvent } = data
  const poster = tmdbImage(title.posterPath, 'w500')
  const plate = posterPlate(title.name)

  const included = offers.filter((o) => o.offerType === 'FLATRATE')
  const paid = offers.filter((o) => o.offerType === 'RENT' || o.offerType === 'BUY')
  const onYours = included.find((o) => o.subscribed)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="grid items-start gap-[clamp(20px,4vw,38px)] md:grid-cols-[190px_minmax(0,1fr)]">
          <div className="max-w-[165px] md:max-w-none">
            <div
              className="relative aspect-[2/3] overflow-hidden rounded-[4px] border border-line"
              style={
                poster
                  ? undefined
                  : { background: `linear-gradient(${plate.angle}deg, ${plate.from}, ${plate.to})` }
              }
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center">
                  <span className="font-display text-4xl font-extrabold tracking-wider text-ink/80">
                    {plate.glyph}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="readout">
              {[title.mediaType === 'TV' ? 'Series' : 'Film', title.year, title.status]
                .filter(Boolean)
                .join(' · ')}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <h1 className="display text-[2rem]">{title.name}</h1>
              {user ? <FollowButton titleId={title.id} following={Boolean(follow)} /> : (
                <Link
                  href="/signup"
                  className="rounded-[4px] bg-signal px-4 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#04120f] hover:bg-[#63ecdd]"
                >
                  Sign up to follow
                </Link>
              )}
            </div>

            <div className="my-6 grid gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Status" value={title.status ?? 'Unknown'} tone="signal" />
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

            <div className="readout mb-2.5">Where it streams · United States</div>
            {offers.length === 0 ? (
              <div className="panel px-3.5 py-3 text-[13.5px] text-ink-dim">
                Not streaming anywhere yet. Follow it and you will hear the moment that changes.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...included, ...paid].map((offer) => (
                  <div
                    key={`${offer.providerId}-${offer.offerType}`}
                    className="flex items-center gap-3 rounded-[4px] border border-line bg-panel px-3.5 py-2.5"
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

            <div className="panel mt-7 p-[clamp(18px,3vw,28px)]">
              <div className="readout mb-1.5">Tell me when</div>
              {user && follow ? (
                <AlertSwitches titleId={title.id} rules={follow.alerts} />
              ) : (
                <>
                  <p className="max-w-[62ch] py-3 text-[14px] text-ink-dim">
                    {user
                      ? 'Follow this title to choose which of the five alerts you want.'
                      : 'Sign up to choose which of the five alerts you want for this title.'}
                  </p>
                  <div className="pointer-events-none opacity-40">
                    <AlertSwitches titleId={title.id} rules={[]} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'signal' | 'live'
}) {
  const color =
    tone === 'signal' ? 'text-signal' : tone === 'live' ? 'text-live' : 'text-ink'
  return (
    <div className="bg-panel px-3.5 py-3">
      <div className="readout">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}
