'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { PosterArt } from '@/components/poster-art'
import { rateTitle } from '@/app/actions/taste'
import type { RatingValue } from '@/generated/prisma/enums'

type Card = { id: string; name: string; year: string | null; genres: string[] }

const VERDICTS: Array<{ value: RatingValue; label: string; tone: string }> = [
  { value: 'LOVED', label: 'I loved this', tone: 'border-signal-deep bg-[var(--signal-glow)] text-signal' },
  { value: 'LIKED', label: 'I liked this', tone: 'border-line-lit text-ink hover:border-signal-deep hover:text-signal' },
  { value: 'NOT_SEEN', label: "I haven't seen this", tone: 'border-line text-ink-faint hover:border-line-lit hover:text-ink-dim' },
  { value: 'DISLIKED', label: 'I disliked this', tone: 'border-line-lit text-ink hover:border-live/50 hover:text-live' },
  { value: 'HATED', label: 'I hated this', tone: 'border-live/35 bg-[var(--live-glow)] text-live' },
]

/**
 * One film at a time, five verdicts.
 *
 * Advances locally the moment a verdict is given so the deck never stalls
 * on a round trip — the server call runs behind it. "Haven't seen this" is
 * recorded rather than skipped: it is real information, and it stops the
 * same card coming back forever.
 */
export function TasteDeck({
  cards,
  alreadyRated,
  target,
}: {
  cards: Card[]
  alreadyRated: number
  target: number
}) {
  const [index, setIndex] = useState(0)
  const [, startTransition] = useTransition()

  const card = cards[index]
  const done = alreadyRated + index
  const progress = Math.min(100, Math.round((done / target) * 100))

  if (!card) {
    return (
      <div className="panel p-8 text-center">
        <div className="readout">Deck empty</div>
        <h2 className="display mt-4 text-[1.4rem]">That is everything we can ask about.</h2>
        <Link
          href="/taste?view=results"
          className="mt-5 inline-block rounded-[4px] bg-signal px-5 py-[11px] text-sm font-semibold text-[#04120f] hover:bg-[#63ecdd]"
        >
          See what we found
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="readout">
            {done} rated{done < target ? ` · ${target - done} to go` : ' · enough to work with'}
          </span>
          {done >= target ? (
            <Link href="/taste?view=results" className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-signal hover:underline">
              See results →
            </Link>
          ) : null}
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full bg-signal transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="mx-auto w-[150px] sm:mx-0 sm:w-full">
          <div className="aspect-[2/3] overflow-hidden rounded-[4px] border border-line">
            <PosterArt name={card.name} />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="readout">{card.genres.slice(0, 3).join(' · ') || 'Film'}</div>
          <h2 className="display mt-3 text-[1.7rem]">{card.name}</h2>
          {card.year ? <div className="mt-1 font-mono text-[12px] text-ink-faint">{card.year}</div> : null}

          <div className="mt-6 flex flex-col gap-2">
            {VERDICTS.map((verdict) => (
              <button
                key={verdict.value}
                type="button"
                onClick={() => {
                  setIndex((i) => i + 1)
                  startTransition(async () => {
                    await rateTitle(card.id, verdict.value)
                  })
                }}
                className={`rounded-[4px] border px-4 py-3 text-left text-sm font-medium transition-colors ${verdict.tone}`}
              >
                {verdict.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
