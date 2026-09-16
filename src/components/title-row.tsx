import { TitlePlate } from '@/components/title-plate'
import type { Row } from '@/lib/rows'

/**
 * A horizontal rail.
 *
 * Rails rather than grids: a page of stacked rails gives a lot to browse
 * without burying the sections underneath, and horizontal overflow is
 * scoped to the rail so the page body never scrolls sideways.
 */
export function TitleRow({ row, base = '/' }: { row: Row; base?: string }) {
  const width = row.feature ? 'w-[168px]' : 'w-[132px]'

  return (
    <section className="mt-[clamp(32px,4vw,48px)]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2.5">
        <h2 className="display text-[1.12rem]">{row.heading}</h2>
        {row.note ? <span className="text-[12px] text-ink-faint">{row.note}</span> : null}
      </div>

      <div
        className="-mx-[var(--gutter)] flex gap-3.5 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:thin]"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {row.titles.map((title) => (
          <div
            key={title.id}
            className={`${width} shrink-0`}
            style={{ scrollSnapAlign: 'start' }}
          >
            <TitlePlate title={title} size={row.feature ? 'large' : 'normal'} base={base} />
          </div>
        ))}
      </div>
    </section>
  )
}
