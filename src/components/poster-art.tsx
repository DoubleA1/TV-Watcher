import { motifPaths, posterPlate } from '@/lib/poster'

/**
 * Generated cover art for a title with no poster image.
 *
 * Drawn rather than fetched: no network, no API key, no broken-image state.
 * Reads as a designed series instead of a placeholder.
 */
export function PosterArt({ name, compact = false }: { name: string; compact?: boolean }) {
  const plate = posterPlate(name)
  const shapes = motifPaths(plate)
  const id = `p${plate.seed.toString(36)}`

  return (
    <svg
      viewBox="0 0 200 300"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label={name}
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"
          gradientTransform={`rotate(${plate.angle - 135} 0.5 0.5)`}>
          <stop offset="0%" stopColor={plate.from} />
          <stop offset="100%" stopColor={plate.to} />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
        </linearGradient>
      </defs>

      <rect width="200" height="300" fill={`url(#${id}g)`} />

      <g stroke={plate.accent} fill={plate.accent} opacity="0.34">
        {shapes.map((shape, i) => {
          const key = `${shape.kind}-${i}`
          if (shape.kind === 'circle') return <circle key={key} {...shape.attrs} />
          if (shape.kind === 'rect') return <rect key={key} {...shape.attrs} />
          if (shape.kind === 'line') return <line key={key} {...shape.attrs} />
          return <path key={key} {...shape.attrs} />
        })}
      </g>

      {/* Scanlines: ties the art to the console language of the rest of the site. */}
      <rect width="200" height="300" fill={`url(#${id}f)`} />
      <g opacity="0.18">
        {Array.from({ length: 100 }, (_, i) => (
          <line key={i} x1="0" x2="200" y1={i * 3} y2={i * 3} stroke="#000" strokeWidth="1" />
        ))}
      </g>

      {!compact ? (
        <text
          x="14"
          y="282"
          fill="rgba(240,246,255,0.94)"
          fontSize="15"
          fontWeight="800"
          letterSpacing="0.5"
          style={{ fontFamily: 'var(--font-archivo), Archivo, sans-serif' }}
        >
          {plate.glyph}
        </text>
      ) : null}
    </svg>
  )
}
