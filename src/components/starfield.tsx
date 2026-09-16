'use client'

import { useEffect, useRef } from 'react'

type Star = { x: number; y: number; z: number; tint: number }

/** Depth travelled per second. Low enough to read as drift, not warp. */
const SPEED = 0.041

function spawn(star: Star, depth?: number) {
  // Spread wider than the viewport so stars keep arriving from beyond the
  // edges rather than only welling up out of the centre.
  star.x = (Math.random() * 2 - 1) * 1.5
  star.y = (Math.random() * 2 - 1) * 1.5
  star.z = depth ?? 1
  star.tint = Math.random()
}

/**
 * Runs the animation. Takes the canvas and context as arguments so nothing
 * inside has to re-prove they exist. Returns a teardown.
 */
function run(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): () => void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let stars: Star[] = []
  let width = 0
  let height = 0
  let raf = 0
  let last = performance.now()

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Density by area, capped so a large display does not melt.
    const target = Math.min(520, Math.round((width * height) / 3200))
    stars = Array.from({ length: target }, () => {
      const s: Star = { x: 0, y: 0, z: 1, tint: 0 }
      spawn(s, Math.random()) // stagger depths so the field starts full
      return s
    })
  }

  const draw = (dt: number) => {
    const cx = width / 2
    const cy = height / 2
    // Half the smaller axis keeps spread consistent across window shapes.
    const scale = Math.min(width, height) * 0.5

    ctx.clearRect(0, 0, width, height)

    for (const star of stars) {
      if (!reduceMotion) {
        star.z -= SPEED * dt
        if (star.z <= 0.02) {
          spawn(star)
          continue
        }
      }

      // Projecting by x/z pushes stars outward as depth shrinks, which reads
      // as the camera moving forward rather than the field drifting.
      const px = cx + (star.x / star.z) * scale
      const py = cy + (star.y / star.z) * scale

      if (px < -40 || px > width + 40 || py < -40 || py > height + 40) {
        if (!reduceMotion) spawn(star)
        continue
      }

      // Nearness drives size and alpha together, so arrival is a fade-in
      // rather than a pop.
      const near = 1 - star.z
      const radius = 0.4 + near * near * 1.7
      const alpha = Math.min(0.7, 0.1 + near * near * 0.8)

      // Mostly cool white; a minority carry the palette's teal.
      ctx.fillStyle =
        star.tint > 0.82
          ? `rgba(69, 224, 208, ${alpha})`
          : `rgba(222, 236, 255, ${alpha})`

      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const frame = (now: number) => {
    // Clamp dt so a backgrounded tab does not teleport the whole field.
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    draw(dt)
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)

  if (reduceMotion) {
    draw(0)
  } else {
    raf = requestAnimationFrame(frame)
  }

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
}

/**
 * Slow forward travel through a starfield, sitting behind the whole site.
 * Background first: low contrast, no competition with the text on top.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    return run(canvas, ctx)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  )
}
