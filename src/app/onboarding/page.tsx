import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getUserServices } from '@/lib/queries'
import { SiteHeader } from '@/components/site-header'
import { ServiceChips } from '@/components/service-chips'
import { AuthForm, Field } from '@/components/auth-form'
import { addPhoneNumber } from '@/app/actions/auth'

/**
 * Post-signup setup.
 *
 * Asked here rather than buried in settings because both answers change what
 * the product can do on day one: without services we cannot tell you
 * something landed on one you pay for, and without a number we cannot text
 * you at all.
 */
export default async function OnboardingPage() {
  const user = await getSessionUser()
  if (!user) redirect('/signup')

  const services = await getUserServices(user.id)
  const chosen = services.filter((s) => s.subscribed).length

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mx-auto max-w-[560px]">
          <div className="readout">Two quick things</div>
          <h1 className="display mt-4 text-[1.9rem]">Set up your alerts</h1>
          <p className="mt-3 text-[14.5px] text-ink-dim">
            Both of these change what we can actually tell you, so they are worth thirty
            seconds now.
          </p>

          <section className="panel mt-6 p-[clamp(20px,4vw,28px)]">
            <div className="flex items-baseline justify-between gap-3">
              <div className="readout">1 · Which services do you pay for?</div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {chosen} selected
              </span>
            </div>
            <p className="mt-2.5 max-w-[52ch] text-[13.5px] text-ink-dim">
              This is what makes “it landed on a service you have” mean anything. Without it,
              every availability alert is a guess about whether you can actually watch the
              thing tonight.
            </p>
            <ServiceChips services={services} />
          </section>

          <section className="panel mt-4 p-[clamp(20px,4vw,28px)]">
            <div className="readout">2 · Where should we text you?</div>
            <p className="mt-2.5 mb-4 max-w-[52ch] text-[13.5px] text-ink-dim">
              Optional, and not switched on yet — carrier registration is still pending. Adding
              it now means you are ready the moment it clears.
            </p>
            <AuthForm action={addPhoneNumber} submitLabel="Save number">
              <Field
                id="phone"
                label="Mobile number"
                type="tel"
                placeholder="(555) 019-4827"
                autoComplete="tel"
                defaultValue={user.phone ?? ''}
              />
            </AuthForm>
            <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
              You only ever get alerts you switched on yourself. Reply STOP any time to end
              them. Message and data rates may apply.
            </p>
          </section>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/search"
              className="rounded-[4px] bg-signal px-5 py-3 text-sm font-semibold text-[#04120f] hover:bg-[#63ecdd]"
            >
              Find something to follow
            </Link>
            <Link href="/queue" className="text-[13px] text-ink-dim hover:text-signal">
              Skip for now
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
