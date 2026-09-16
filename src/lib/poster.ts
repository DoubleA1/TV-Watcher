/**
 * Generated poster art.
 *
 * Real posters come from TMDB and need an API key plus network access to
 * image.tmdb.org. Until both exist we draw something deliberate rather than
 * show a grey box: a duotone ground, one of several geometric motifs, and
 * the title set in the display face. Everything derives from a hash of the
 * name, so a title always looks the same and a grid of them looks composed
 * rather than random.
 */

/** FNV-1a. Small, stable, and spreads titles evenly across the palette. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic 0..1 stream, so one name yields many stable decisions. */
function rng(seed: number) {
  let s = seed || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

export type Motif = 'rings' | 'horizon' | 'bars' | 'orbit' | 'grid' | 'prism'

const MOTIFS: Motif[] = ['rings', 'horizon', 'bars', 'orbit', 'grid', 'prism']

export type PosterPlate = {
  from: string
  to: string
  accent: string
  angle: number
  motif: Motif
  glyph: string
  seed: number
}

export function posterPlate(name: string, seed: string = name): PosterPlate {
  const h = hash(seed)
  const base = h % 360

  // Bias toward the cold end so plates sit inside the palette, with a
  // minority of warm outliers to keep a grid from reading as monotone.
  const warm = base % 7 === 0
  const hue = warm ? 18 + ((base * 11) % 34) : 188 + ((base * 7) % 96)
  const shift = 26 + ((h >>> 5) % 42)

  return {
    from: `hsl(${hue} ${warm ? 58 : 64}% ${18 + ((h >>> 3) % 9)}%)`,
    to: `hsl(${(hue + shift) % 360} 52% 7%)`,
    accent: `hsl(${(hue + 180) % 360} 70% 62%)`,
    angle: 130 + ((h >>> 8) % 70),
    motif: MOTIFS[h % MOTIFS.length],
    glyph: initials(name),
    seed: h,
  }
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(the|a|an|of|and|part|in|on)$/i.test(w))

  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Geometry for one motif, in a 200x300 viewBox. */
export function motifPaths(plate: PosterPlate): Array<{
  kind: 'circle' | 'rect' | 'path' | 'line'
  attrs: Record<string, string | number>
}> {
  const r = rng(plate.seed)
  const out: Array<{ kind: 'circle' | 'rect' | 'path' | 'line'; attrs: Record<string, string | number> }> = []

  switch (plate.motif) {
    case 'rings': {
      const cx = 60 + r() * 80
      const cy = 90 + r() * 70
      for (let i = 0; i < 5; i++) {
        out.push({
          kind: 'circle',
          attrs: { cx, cy, r: 18 + i * 17, fill: 'none', strokeWidth: i === 2 ? 1.6 : 0.7 },
        })
      }
      break
    }
    case 'horizon': {
      const y = 120 + r() * 60
      const cx = 50 + r() * 100
      out.push({ kind: 'circle', attrs: { cx, cy: y - 26, r: 34 + r() * 16, fill: 'none', strokeWidth: 1.4 } })
      for (let i = 0; i < 6; i++) {
        out.push({ kind: 'line', attrs: { x1: 0, x2: 200, y1: y + i * 9, y2: y + i * 9, strokeWidth: 0.6 } })
      }
      break
    }
    case 'bars': {
      let x = 14
      while (x < 186) {
        const w = 2 + Math.round(r() * 9)
        const h = 70 + r() * 150
        out.push({ kind: 'rect', attrs: { x, y: 300 - h - 40, width: w, height: h, strokeWidth: 0 } })
        x += w + 4 + Math.round(r() * 7)
      }
      break
    }
    case 'orbit': {
      const cx = 100
      const cy = 130
      out.push({ kind: 'circle', attrs: { cx, cy, r: 52, fill: 'none', strokeWidth: 0.8 } })
      out.push({ kind: 'circle', attrs: { cx, cy, r: 84, fill: 'none', strokeWidth: 0.5 } })
      for (let i = 0; i < 7; i++) {
        const angle = r() * Math.PI * 2
        const radius = i % 2 === 0 ? 52 : 84
        out.push({
          kind: 'circle',
          attrs: {
            cx: cx + Math.cos(angle) * radius,
            cy: cy + Math.sin(angle) * radius,
            r: 1.6 + r() * 3,
            strokeWidth: 0,
          },
        })
      }
      break
    }
    case 'grid': {
      // Perspective floor: lines converge on a vanishing point.
      const vx = 60 + r() * 80
      const vy = 96
      for (let i = -3; i <= 9; i++) {
        out.push({ kind: 'line', attrs: { x1: i * 26, y1: 300, x2: vx, y2: vy, strokeWidth: 0.55 } })
      }
      for (let i = 1; i < 8; i++) {
        const y = vy + Math.pow(i, 1.9) * 3.4
        if (y > 300) break
        out.push({ kind: 'line', attrs: { x1: 0, x2: 200, y1: y, y2: y, strokeWidth: 0.55 } })
      }
      break
    }
    case 'prism': {
      const x = 40 + r() * 60
      out.push({ kind: 'path', attrs: { d: `M${x} 70 L${x + 62} 178 L${x - 62} 178 Z`, fill: 'none', strokeWidth: 1.5 } })
      for (let i = 0; i < 5; i++) {
        out.push({
          kind: 'line',
          attrs: { x1: x - 58 + i * 3, y1: 178, x2: 200, y2: 150 + i * 13, strokeWidth: 0.8 },
        })
      }
      break
    }
  }

  return out
}
