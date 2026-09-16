/**
 * Placeholder poster art.
 *
 * Real posters come from TMDB and need an API key plus an ingest pass. Until
 * that lands we render a deterministic plate per title rather than a broken
 * image or a grey box: same title always yields the same colours, so the grid
 * looks composed instead of random, and it reads as a deliberate treatment
 * rather than missing data.
 */

/** FNV-1a. Small, stable, and good enough to spread titles across hues. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export type PosterPlate = {
  from: string
  to: string
  angle: number
  glyph: string
}

export function posterPlate(name: string, seed: string = name): PosterPlate {
  const h = hash(seed)

  // Bias hues toward the cold end of the wheel so plates sit inside the
  // palette, with occasional warm outliers for variety.
  const base = h % 360
  const cold = 190 + ((base * 7) % 90) // 190deg–280deg: cyan → indigo
  const warm = 24 + ((base * 11) % 26) // rare amber
  const hue = base % 9 === 0 ? warm : cold

  return {
    from: `hsl(${hue} 62% 22%)`,
    to: `hsl(${(hue + 38) % 360} 55% 9%)`,
    angle: 135 + ((h >>> 8) % 60),
    glyph: initials(name),
  }
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(the|a|an|of|and|part)$/i.test(w))

  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
