import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { isLiveData } from '@/lib/providers'
import { signOut } from '@/app/actions/auth'

export async function SiteHeader() {
  const user = await getSessionUser()
  const live = isLiveData()

  return (
    <header
      className="sticky z-40 border-b border-line bg-void/90 backdrop-blur-xl"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-4 px-[var(--gutter)] py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_0_3px_var(--signal-glow)]" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.1em]">
            TV-Watcher
          </span>
        </Link>

        {!live ? (
          <span className="rounded-[4px] border border-live/30 glow-live px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-live">
            Sample data
          </span>
        ) : null}

        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          <HeaderLink href="/search">Search</HeaderLink>
          {user ? (
            <>
              <HeaderLink href="/queue">My queue</HeaderLink>
              <HeaderLink href="/settings">Settings</HeaderLink>
              <form action={signOut}>
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint transition-colors hover:border-line hover:text-ink-dim"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <HeaderLink href="/login">Sign in</HeaderLink>
              <Link
                href="/signup"
                className="ml-1 whitespace-nowrap rounded-[4px] bg-signal px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[#04120f] transition-colors hover:bg-[#63ecdd]"
              >
                Start tracking
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint transition-colors hover:border-line hover:text-ink-dim"
    >
      {children}
    </Link>
  )
}
