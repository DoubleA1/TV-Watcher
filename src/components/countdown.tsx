'use client'

import { useEffect, useState } from 'react'

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Ticking countdown to a drop.
 *
 * Renders nothing until mounted, because the server and the client will
 * disagree about "now" and a hydration mismatch on the hero is worse than
 * a frame of blank digits.
 */
export function Countdown({ target }: { target: string }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const at = new Date(target).getTime()
    const update = () => setRemaining(at - Date.now())
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])

  const p = remaining === null ? null : parts(remaining)

  return (
    <div className="mt-5 grid grid-cols-4 gap-2">
      {(
        [
          ['Days', p ? pad(p.d) : '--'],
          ['Hrs', p ? pad(p.h) : '--'],
          ['Min', p ? pad(p.m) : '--'],
          ['Sec', p ? pad(p.s) : '--'],
        ] as const
      ).map(([label, value]) => (
        <div
          key={label}
          className="rounded-[4px] border border-line bg-panel-2 px-1.5 pb-2 pt-3 text-center"
        >
          <div className="font-mono text-[clamp(1.4rem,4vw,1.85rem)] font-semibold leading-none tabular-nums">
            {value}
          </div>
          <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink-faint">
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
