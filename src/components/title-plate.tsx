import Link from 'next/link'
import { posterPlate } from '@/lib/poster'
import { tmdbImage } from '@/lib/providers'
import type { PlateTitle } from '@/lib/queries'

/**
 * A title in a grid. Falls back to a deterministic colour plate when there
 * is no poster — same title, same plate, every time, so a grid of them
 * looks composed rather than random.
 */
export function TitlePlate({ title, tag }: { title: PlateTitle; tag?: string | null }) {
  const poster = tmdbImage(title.posterPath)
  const plate = posterPlate(title.name)

  return (
    <Link href={`/title/${title.id}`} className="group block text-left">
      <div
        className="relative aspect-[2/3] max-w-full overflow-hidden rounded-[4px] border border-line transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-line-lit"
        style={
          poster
            ? undefined
            : { background: `linear-gradient(${plate.angle}deg, ${plate.from}, ${plate.to})` }
        }
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center">
            <span className="font-display text-3xl font-extrabold tracking-wider text-ink/80">
              {plate.glyph}
            </span>
          </div>
        )}

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px)',
          }}
        />

        {tag ? (
          <span className="absolute left-[7px] top-[7px] z-[2] rounded-[3px] border border-line-lit bg-void/80 px-1.5 py-[3px] font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim">
            {tag}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-[13px] font-medium leading-snug">{title.name}</div>
      <div className="mt-0.5 font-mono text-[10.5px] tracking-wide text-ink-faint">
        {[title.year, title.mediaType === 'TV' ? 'Series' : 'Film'].filter(Boolean).join(' · ')}
      </div>
    </Link>
  )
}
