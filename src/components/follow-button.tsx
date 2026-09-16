'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleFollow } from '@/app/actions/follow'

export function FollowButton({
  titleId,
  following,
}: {
  titleId: string
  following: boolean
}) {
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(following, (_, next: boolean) => next)

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic)
          await toggleFollow(titleId)
        })
      }
      className={`rounded-[4px] border px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors ${
        optimistic
          ? 'border-signal-deep glow-signal text-signal'
          : 'border-line-lit text-ink-dim hover:border-signal-deep hover:text-signal'
      }`}
    >
      {optimistic ? 'Following' : 'Follow'}
    </button>
  )
}
