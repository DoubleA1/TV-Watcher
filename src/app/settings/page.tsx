import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getUserServices } from '@/lib/queries'
import { SiteHeader } from '@/components/site-header'
import { ServiceChips } from '@/components/service-chips'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/settings')

  const services = await getUserServices(user.id)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mx-auto max-w-[640px]">
          <div className="mb-4 border-b border-line pb-3">
            <h1 className="display text-[1.22rem]">Settings</h1>
          </div>

          <section className="panel p-[clamp(20px,4vw,28px)]">
            <div className="readout">Which services do you pay for?</div>
            <p className="mt-2.5 max-w-[62ch] text-[13.5px] text-ink-dim">
              This is what makes “it landed on a service you have” mean anything. Alerts for
              everything else stay quiet unless you ask for them per title.
            </p>
            <ServiceChips services={services} />
          </section>

          <section className="panel mt-4 p-[clamp(20px,4vw,28px)]">
            <div className="readout">How we reach you</div>
            <dl className="mt-3.5 flex flex-col gap-3 text-[13.5px]">
              <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                <dt className="text-ink-dim">Email</dt>
                <dd className="font-mono text-[12.5px]">{user.email ?? 'Not set'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-dim">Text message</dt>
                <dd className="font-mono text-[12.5px] text-live">Pending carrier approval</dd>
              </div>
            </dl>
            <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
              US texting requires A2P 10DLC registration, which takes about a week to clear.
              Until it does, alerts go out by email and nothing is sent to your phone.
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
