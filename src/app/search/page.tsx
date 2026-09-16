import Link from 'next/link'
import { searchCatalog } from '@/lib/queries'
import { SiteHeader } from '@/components/site-header'
import { TitlePlate } from '@/components/title-plate'

export default async function SearchPage({
  searchParams,
}: PageProps<'/search'>) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const results = q ? await searchCatalog(q, 18) : []

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-[var(--gutter)] pb-24 pt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
          <h1 className="display text-[1.22rem]">Find something to follow</h1>
          <span className="text-[12.5px] text-ink-faint">
            Shows, films, and things that are not out yet
          </span>
        </div>

        <form method="get" className="relative mb-6 max-w-[560px]">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="q" className="sr-only">Search titles</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Try “dune”, “severance”, “the bear”…"
            className="input-console pl-10"
            autoComplete="off"
          />
        </form>

        {q ? (
          <>
            <div className="readout mb-3">
              {results.length} {results.length === 1 ? 'result' : 'results'} for “{q}”
            </div>
            {results.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3.5">
                {results.map((t) => (
                  <TitlePlate key={t.id} title={t} tag={t.status === 'Post Production' ? 'Not out yet' : null} />
                ))}
              </div>
            ) : (
              <p className="max-w-[62ch] text-[14.5px] text-ink-dim">
                Nothing matched. Try fewer words, or the original title if it was renamed
                for release.
              </p>
            )}
          </>
        ) : (
          <p className="max-w-[62ch] text-[14.5px] text-ink-dim">
            Films that have not been released yet can still be followed — that is the point of
            the <span className="text-ink">finally streaming</span> alert. Follow it the day you
            see the trailer and it sits there quietly for however many months it takes.
          </p>
        )}

        <footer className="mt-16 border-t border-line pt-5 text-xs text-ink-faint">
          <Link href="/" className="hover:text-ink-dim">Back to the front</Link>
        </footer>
      </main>
    </>
  )
}
