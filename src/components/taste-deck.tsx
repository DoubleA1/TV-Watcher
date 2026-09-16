'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { PosterArt } from '@/components/poster-art'
import { VerdictButtons } from '@/components/verdict-buttons'
import { rateTitle, dismissSuggestion } from '@/app/actions/taste'
import type { RatingValue } from '@/generated/prisma/enums'

type Card = { id: string; name: string; year: string | null; genres: string[] }

export type Suggestion = {
  id: string
  name: string
  year: string | null
  reason: string
  availableOn: string[]
}

/**
 * The rating deck.
 *
 * Advances locally the instant a verdict is given so the deck never stalls
 * on a round trip; the server call runs behind it. Every fifth counted
 * verdict pauses for a suggestion, which is the whole reward loop — rating
 * films with no payoff until the end would be a chore.
 */
export function TasteDeck({
  cards,
  counted,
  freeLimit,
  interval,
  suggestion,
  isPro,
}: {
  cards: Card[]
  counted: number
  freeLimit: number
  interval: number
  suggestion: Suggestion | null
  isPro: boolean
}) {
  const [index, setIndex] = useState(0)
  // Counted verdicts added during this session, so the milestone can fire
  // without waiting for a server round trip.
  const [localCounted, setLocalCounted] = useState(0)
  const [dismissedHere, setDismissedHere] = useState(false)
  const [pending, startTransition] = useTransition()

  const totalCounted = counted + localCounted
  const remaining = Math.max(0, freeLimit - totalCounted)
  const card = cards[index]

  // Pause on a suggestion when a milestone has just been crossed and the
  // server has one ready for us.
  const atMilestone = totalCounted > 0 && totalCounted % interval === 0
  const showSuggestion = atMilestone && suggestion !== null && !dismissedHere

  if (!isPro && remaining === 0 && !showSuggestion) {
    return <Paywall counted={totalCounted} />
  }

  if (showSuggestion && suggestion) {
    return (
      <SuggestionCard
        suggestion={suggestion}
        counted={totalCounted}
        remaining={remaining}
        isPro={isPro}
        pending={pending}
        onSeenIt={() => {
          setDismissedHere(true)
          startTransition(async () => {
            await dismissSuggestion(suggestion.id)
            setDismissedHere(false)
          })
        }}
        onKeepRating={() => setDismissedHere(true)}
      />
    )
  }

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

  const onVerdict = (value: RatingValue) => {
    setIndex((i) => i + 1)
    if (value !== 'NOT_SEEN') setLocalCounted((c) => c + 1)
    startTransition(async () => {
      await rateTitle(card.id, value)
    })
  }

  const progress = Math.min(100, Math.round((totalCounted / freeLimit) * 100))
  // At zero the modulo is also zero, which would read as "unlocked" before
  // anything has been rated.
  const toNextSuggestion = interval - (totalCounted % interval)

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="readout">
            {isPro
              ? `${totalCounted} rated`
              : `${totalCounted} of ${freeLimit} free ratings`}
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">
            {atMilestone
              ? 'Suggestion ready'
              : `${toNextSuggestion} until a suggestion`}
          </span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full bg-signal transition-[width] duration-300"
            style={{ width: `${isPro ? 100 : progress}%` }}
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="grid sm:grid-cols-[190px_minmax(0,1fr)]">
          <div className="mx-auto w-[170px] p-4 sm:mx-0 sm:w-full sm:p-4">
            <div className="aspect-[2/3] overflow-hidden rounded-[4px] border border-line">
              <PosterArt name={card.name} />
            </div>
          </div>

          <div className="flex flex-col justify-center p-5 pt-0 sm:p-6 sm:pl-2">
            <div className="readout">{card.genres.slice(0, 3).join(' · ') || 'Film'}</div>
            <h2 className="display mt-2.5 text-[clamp(1.3rem,3.6vw,1.75rem)]">{card.name}</h2>
            {card.year ? (
              <div className="mt-1 font-mono text-[12px] text-ink-faint">{card.year}</div>
            ) : null}

            <p className="mt-4 text-[13px] text-ink-dim">Have you seen it? What did you think?</p>

            <div className="mt-3">
              <VerdictButtons onVerdict={onVerdict} disabled={pending && index === 0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  counted,
  remaining,
  isPro,
  pending,
  onSeenIt,
  onKeepRating,
}: {
  suggestion: Suggestion
  counted: number
  remaining: number
  isPro: boolean
  pending: boolean
  onSeenIt: () => void
  onKeepRating: () => void
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line bg-panel-2 px-5 py-3">
        <div className="readout text-signal">
          Based on your {counted} {counted === 1 ? 'choice' : 'choices'}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[170px_minmax(0,1fr)] sm:p-6">
        <div className="mx-auto w-[150px] sm:mx-0 sm:w-full">
          <div className="aspect-[2/3] overflow-hidden rounded-[4px] border border-line">
            <PosterArt name={suggestion.name} />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[14px] text-ink-dim">We think you&apos;d like</p>
          <h2 className="display mt-1.5 text-[clamp(1.4rem,4vw,2rem)]">{suggestion.name}</h2>
          <div className="mt-1.5 font-mono text-[11.5px] text-ink-faint">{suggestion.year}</div>

          <div className="mt-3 inline-block rounded-[3px] border border-signal-deep glow-signal px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-signal">
            {suggestion.reason}
          </div>

          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-dim">
            {suggestion.availableOn.length > 0
              ? suggestion.availableOn.slice(0, 3).join(' · ')
              : 'Not streaming yet'}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onKeepRating}
              className="rounded-[4px] bg-signal px-5 py-3 text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd]"
            >
              {isPro || remaining > 0 ? 'Keep rating' : 'Done for now'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onSeenIt}
              className="rounded-[4px] border border-line-lit px-5 py-3 text-sm font-medium text-ink-dim transition-colors hover:border-signal-deep hover:text-signal disabled:opacity-50"
            >
              {pending ? 'Finding another…' : "I've seen that before"}
            </button>
          </div>

          {!isPro ? (
            <p className="mt-4 text-[11.5px] text-ink-faint">
              {remaining > 0
                ? `${remaining} free ${remaining === 1 ? 'rating' : 'ratings'} left.`
                : 'That was your last free rating.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Paywall({ counted }: { counted: number }) {
  return (
    <div className="panel p-[clamp(22px,4vw,36px)] text-center">
      <div className="readout text-live">Free allowance used</div>
      <h2 className="display mx-auto mt-4 max-w-[20ch] text-[clamp(1.5rem,4vw,2rem)]">
        You&apos;ve rated {counted} films and had three suggestions.
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-[14.5px] text-ink-dim">
        Keep going and the picks get sharper — the model has enough to know roughly what you
        like, and a few dozen more verdicts is where it starts surprising you.
      </p>

      <div className="mx-auto mt-6 flex max-w-[380px] flex-col gap-2">
        <button
          type="button"
          className="rounded-[4px] bg-signal px-5 py-3 text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd]"
        >
          Unlock unlimited ratings
        </button>
        <Link
          href="/taste?view=results"
          className="rounded-[4px] border border-line-lit px-5 py-3 text-sm font-medium text-ink-dim transition-colors hover:border-signal-deep hover:text-signal"
        >
          See what we found so far
        </Link>
      </div>

      <p className="mt-5 text-[11.5px] text-ink-faint">
        Payment is not wired up yet — this button does nothing today.
      </p>
    </div>
  )
}
