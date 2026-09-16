import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getUserFollows, getUserQueue, getUserServices } from '@/lib/queries'
import { sheetBase } from '@/lib/sheet'
import { SiteHeader } from '@/components/site-header'
import { TitlePlate } from '@/components/title-plate'
import { TitleSheet } from '@/components/title-sheet'
import { ServiceChips } from '@/components/service-chips'
import { AuthForm, Field } from '@/components/auth-form'
import { SIGNAL_BY_TYPE } from '@/components/signals'
import { addPhoneNumber } from '@/app/actions/auth'
import { sheetHref } from '@/lib/sheet'

function dayLabel(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(d)
}

function timeLabel(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(d)
}

/**
 * Following.
 *
 * Everything about your own account in one place: what is armed, what you
 * track, which services you pay for, and how we reach you. Settings used to
 * be a separate page, but they are only ever read in the context of "why did
 * or didn't I get told about this", which is exactly this page.
 */
export default async function FollowingPage({ searchParams }: PageProps<'/following'>) {
  const user = await getSessionUser()
  if (!user) redirect('/welcome?next=/following')

  const params = await searchParams
  const openTitle = typeof params.title === 'string' ? params.title : null
  const base = sheetBase('/following', params)

  const [queue, follows, services] = await Promise.all([
    getUserQueue(user.id, 40),
    getUserFollows(user.id),
    getUserServices(user.id),
  ])

  const chosen = services.filter((s) => s.subscribed)
  const groups = new Map<string, typeof queue>()
  for (const event of queue) {
    const key = dayLabel(event.occursAt, user.timezone)
    groups.set(key, [...(groups.get(key) ?? []), event])
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-9">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="readout">Your account</div>
            <h1 className="display mt-3 text-[1.8rem]">Following</h1>
          </div>
          <span className="font-mono text-[11px] text-ink-faint">
            {follows.length} tracked · {queue.length} armed
          </span>
        </div>

        {/* First run: without services, availability alerts cannot mean
            anything, so this is a prompt rather than a quiet default. */}
        {chosen.length === 0 ? (
          <section className="mb-6 rounded-md border border-live/35 glow-live p-5">
            <div className="readout text-live">Finish setting up</div>
            <h2 className="display mt-2.5 text-[1.15rem]">
              Tell us which services you pay for.
            </h2>
            <p className="mt-2 max-w-[58ch] text-[13.5px] text-ink-dim">
              Until you do, we cannot tell you that something landed on a service you already
              have — which is the alert most people actually want.
            </p>
            <ServiceChips services={services} />
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2.5">
            <h2 className="display text-[1.12rem]">What is coming</h2>
            <span className="text-[12px] text-ink-faint">Alerts already armed</span>
          </div>

          {queue.length === 0 ? (
            <div className="panel p-6">
              <p className="max-w-[62ch] text-[14.5px] text-ink-dim">
                Nothing armed yet. Follow a show or a film and any upcoming drops show up here —
                and go to your phone when they land.
              </p>
              <Link
                href="/"
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
                        className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line bg-panel px-4 py-3 last:border-b-0"
                      >
                        <div className="font-mono text-xs tabular-nums text-ink-dim">
                          {timeLabel(event.occursAt, user.timezone)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={sheetHref(base, event.title.id)}
                            scroll={false}
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
        </section>

        {follows.length > 0 ? (
          <section className="mt-[clamp(32px,4vw,48px)]">
            <div className="mb-3 border-b border-line pb-2.5">
              <h2 className="display text-[1.12rem]">Everything you follow</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3.5">
              {follows.map((t) => (
                <TitlePlate key={t.id} title={t} base={base} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-[clamp(32px,4vw,48px)] grid gap-4 lg:grid-cols-2">
          <div className="panel p-[clamp(18px,3vw,26px)]">
            <div className="readout">Services you pay for</div>
            <p className="mt-2.5 max-w-[52ch] text-[13.5px] text-ink-dim">
              This is what makes “it landed on a service you have” mean anything.
            </p>
            <ServiceChips services={services} />
          </div>

          <div className="panel p-[clamp(18px,3vw,26px)]">
            <div className="readout">How we reach you</div>
            <dl className="mt-3.5 flex flex-col gap-3 text-[13.5px]">
              <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                <dt className="text-ink-dim">Email</dt>
                <dd className="font-mono text-[12.5px]">{user.email ?? 'Not set'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                <dt className="text-ink-dim">Text message</dt>
                <dd className="font-mono text-[12.5px] text-live">
                  {user.phone ? 'Awaiting carrier approval' : 'No number yet'}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <AuthForm action={addPhoneNumber} submitLabel={user.phone ? 'Update number' : 'Add number'}>
                <Field
                  id="phone"
                  label="Mobile number"
                  type="tel"
                  placeholder="(555) 019-4827"
                  autoComplete="tel"
                  defaultValue={user.phone ?? ''}
                />
              </AuthForm>
            </div>

            <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
              US texting needs A2P 10DLC registration, which takes about a week to clear. Until
              it does, alerts go by email and nothing is sent to your phone. Reply STOP any time
              to end them.
            </p>
          </div>
        </section>
      </main>

      {openTitle ? <TitleSheet titleId={openTitle} closeHref={base} /> : null}
    </>
  )
}
