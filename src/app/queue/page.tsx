import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getUserFollows, getUserQueue } from '@/lib/queries'
import { SiteHeader } from '@/components/site-header'
import { TitlePlate } from '@/components/title-plate'
import { SIGNAL_BY_TYPE } from '@/components/signals'

/** Group by calendar day in the user's own zone, not the server's. */
function dayKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(d)
}

function timeOfDay(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(d)
}

export default async function QueuePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/queue')

  const [queue, follows] = await Promise.all([
    getUserQueue(user.id, 30),
    getUserFollows(user.id),
  ])

  const groups = new Map<string, typeof queue>()
  for (const event of queue) {
    const key = dayKey(event.occursAt, user.timezone)
    groups.set(key, [...(groups.get(key) ?? []), event])
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
          <h1 className="display text-[1.22rem]">What is coming</h1>
          <span className="text-[12.5px] text-ink-faint">
            {follows.length} followed · {queue.length} alerts armed
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="panel p-6">
            <p className="max-w-[62ch] text-[14.5px] text-ink-dim">
              Nothing armed yet. Follow a show or a film and any upcoming drops will show up
              here — and go to your phone when they land.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-block rounded-[4px] bg-signal px-4 py-2.5 text-sm font-semibold text-[#04120f] hover:bg-[#63ecdd]"
            >
              Find something to follow
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line">
            {[...groups.entries()].map(([day, events]) => (
              <div key={day}>
                <div className="border-b border-line bg-panel-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  {day}
                </div>
                {events.map((event) => {
                  const payload = (event.payload ?? {}) as {
                    seasonNumber?: number
                    episodeNumber?: number
                    providerName?: string
                  }
                  const signal = SIGNAL_BY_TYPE.get(event.eventType)
                  const code =
                    payload.seasonNumber && payload.episodeNumber
                      ? `S${String(payload.seasonNumber).padStart(2, '0')}E${String(payload.episodeNumber).padStart(2, '0')}`
                      : payload.seasonNumber
                        ? `Season ${payload.seasonNumber}`
                        : null

                  return (
                    <div
                      key={event.id}
                      className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line bg-panel px-4 py-3 last:border-b-0"
                    >
                      <div className="font-mono text-xs tabular-nums text-ink-dim">
                        {timeOfDay(event.occursAt, user.timezone)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/title/${event.title.id}`}
                          className="block truncate text-sm font-medium hover:text-signal"
                        >
                          {event.title.name}
                          {code ? ` — ${code}` : ''}
                        </Link>
                        <div className="mt-0.5 truncate font-mono text-[10.5px] tracking-wide text-ink-faint">
                          {[payload.providerName, signal?.label].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className="whitespace-nowrap rounded-[3px] border border-signal-deep glow-signal px-2 py-1 font-mono text-[10px] uppercase tracking-[0.11em] text-signal">
                        Armed
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {follows.length > 0 ? (
          <section className="mt-[clamp(40px,6vw,62px)]">
            <div className="mb-4 border-b border-line pb-3">
              <h2 className="display text-[1.22rem]">Everything you follow</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3.5">
              {follows.map((t) => (
                <TitlePlate key={t.id} title={t} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  )
}
