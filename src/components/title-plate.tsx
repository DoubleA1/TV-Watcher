import Link from 'next/link'
import { PosterArt } from '@/components/poster-art'
import { tmdbImage } from '@/lib/providers'
import type { PlateTitle } from '@/lib/queries'

/**
 * A title in a grid or rail. Uses the real poster when we have one and
 * generated art otherwise, so a card is never a grey box or a broken image.
 */
export function TitlePlate({
  title,
  tag,
  size = 'normal',
}: {
  title: PlateTitle
  tag?: string | null
  size?: 'normal' | 'large'
}) {
  const poster = tmdbImage(title.posterPath, size === 'large' ? 'w500' : 'w342')

  return (
    <Link href={`/title/${title.id}`} className="group block text-left">
      <div className="relative aspect-[2/3] max-w-full overflow-hidden rounded-[4px] border border-line transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-line-lit">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <PosterArt name={title.name} />
        )}

        {tag ? (
          <span className="absolute left-[7px] top-[7px] z-[2] rounded-[3px] border border-line-lit bg-void/85 px-1.5 py-[3px] font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim">
            {tag}
          </span>
        ) : null}
      </div>

      <div className={`mt-2 font-medium leading-snug ${size === 'large' ? 'text-sm' : 'text-[13px]'}`}>
        {title.name}
      </div>
      <div className="mt-0.5 font-mono text-[10.5px] tracking-wide text-ink-faint">
        {[title.year, title.mediaType === 'TV' ? 'Series' : 'Film'].filter(Boolean).join(' · ')}
      </div>
    </Link>
  )
}
