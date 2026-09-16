import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { signIn, signInAsDemo } from '@/app/actions/auth'
import { SiteHeader } from '@/components/site-header'
import { AuthForm, Field } from '@/components/auth-form'

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/queue')

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mx-auto max-w-[430px]">
          <div className="mb-6 text-center">
            <div className="readout">Welcome back</div>
            <h1 className="display mt-5 text-[1.7rem]">Sign in</h1>
          </div>

          <div className="panel p-[clamp(20px,4vw,30px)]">
            <AuthForm action={signIn} submitLabel="Sign in">
              <Field id="email" label="Email" type="email" autoComplete="email" required />
              <Field
                id="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
              />
            </AuthForm>
          </div>

          <p className="mt-4 text-center text-[13px] text-ink-dim">
            No account yet?{' '}
            <Link href="/signup" className="text-signal hover:underline">Start tracking</Link>
          </p>

          {process.env.NODE_ENV !== 'production' ? (
            <form action={signInAsDemo} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-[4px] border border-live/35 glow-live px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-live"
              >
                Open the seeded demo account
              </button>
            </form>
          ) : null}
        </div>
      </main>
    </>
  )
}
