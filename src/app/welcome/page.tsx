import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { signIn, signUpWithEmail, startPhoneSignUp, signInAsDemo } from '@/app/actions/auth'
import { SiteHeader } from '@/components/site-header'
import { AuthForm, Field } from '@/components/auth-form'

/**
 * The only auth page.
 *
 * Sign in and sign up are the same decision from the visitor's side — "let
 * me in" — so they share a page and a mode toggle rather than being two
 * routes you bounce between.
 */
export default async function WelcomePage({ searchParams }: PageProps<'/welcome'>) {
  if (await getSessionUser()) redirect('/following')

  const params = await searchParams
  const signingIn = params.mode === 'signin'

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mx-auto max-w-[430px]">
          <div className="mb-6 text-center">
            <div className="readout">{signingIn ? 'Welcome back' : 'Step 1 of 2'}</div>
            <h1 className="display mt-5 text-[1.7rem]">
              {signingIn ? 'Sign in' : 'Where should we reach you?'}
            </h1>
            {!signingIn ? (
              <p className="mx-auto mt-3 max-w-[46ch] text-[14.5px] text-ink-dim">
                A text is the point. Email works too, but it will not wake you up for a
                midnight drop. We ask about your streaming services next.
              </p>
            ) : null}
          </div>

          <div className="panel p-[clamp(20px,4vw,30px)]">
            {signingIn ? (
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
            ) : (
              <>
                <AuthForm action={startPhoneSignUp} submitLabel="Send me a code">
                  <Field
                    id="phone"
                    label="Mobile number"
                    type="tel"
                    placeholder="(555) 019-4827"
                    autoComplete="tel"
                  />
                </AuthForm>

                <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
                  We text a six-digit code to confirm the number. After that you only get
                  alerts you switched on yourself. Reply STOP any time to end them. Message and
                  data rates may apply.
                </p>

                <div className="my-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                  <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
                </div>

                <AuthForm action={signUpWithEmail} submitLabel="Create account with email">
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                  <Field
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    required
                    minLength={12}
                  />
                </AuthForm>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-[13px] text-ink-dim">
            {signingIn ? (
              <>
                No account yet?{' '}
                <Link href="/welcome" className="text-signal hover:underline">Start tracking</Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/welcome?mode=signin" className="text-signal hover:underline">
                  Sign in
                </Link>
              </>
            )}
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
