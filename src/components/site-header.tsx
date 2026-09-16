import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { isLiveData } from '@/lib/providers'
import { signOut } from '@/app/actions/auth'

/**
 * Three destinations, and that is the whole site: browse, what you track,
 * and help me choose. Everything else is an overlay or a section.
 */
const NAV = [
  { href: '/', label: 'Discover' },
  { href: '/following', label: 'Following' },
  { href: '/taste', label: 'Find a film' },
]

export async function SiteHeader() {
  const user = await getSessionUser()
  const live = isLiveData()

  return (
    <header
      className="sticky z-40 border-b border-line bg-void/90 backdrop-blur-xl"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2 px-[var(--gutter)] py-3">
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
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint transition-colors hover:border-line hover:text-ink-dim"
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <form action={signOut}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint transition-colors hover:border-line hover:text-ink-dim"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/welcome"
              className="ml-1 whitespace-nowrap rounded-[4px] bg-signal px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[#04120f] transition-colors hover:bg-[#63ecdd]"
            >
              Start tracking
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
