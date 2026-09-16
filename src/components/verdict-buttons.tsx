'use client'

import type { RatingValue } from '@/generated/prisma/enums'

/**
 * The verdict control.
 *
 * Sentiment runs along one axis, worst to best, so the row reads as a scale
 * rather than a list of unrelated options. "I have not seen it" is not a
 * point on that scale — it is a different kind of answer — so it sits apart
 * and looks it.
 */
const SCALE: Array<{ value: RatingValue; label: string; classes: string }> = [
  {
    value: 'HATED',
    label: 'Hated it',
    classes: 'border-live/45 bg-[var(--live-glow)] text-live hover:border-live/70',
  },
  {
    value: 'DISLIKED',
    label: 'Not for me',
    classes: 'border-line-lit text-ink-dim hover:border-live/45 hover:text-live',
  },
  {
    value: 'LIKED',
    label: 'Liked it',
    classes: 'border-line-lit text-ink hover:border-signal-deep hover:text-signal',
  },
  {
    value: 'LOVED',
    label: 'Loved it',
    classes: 'border-signal-deep bg-[var(--signal-glow)] text-signal hover:border-signal',
  },
]

export function VerdictButtons({
  onVerdict,
  disabled = false,
}: {
  onVerdict: (value: RatingValue) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
        <span>Worse</span>
        <span>Better</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SCALE.map((option, i) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onVerdict(option.value)}
            className={`flex flex-col items-center gap-1.5 rounded-[5px] border px-3 py-3.5 text-center transition-colors disabled:opacity-40 ${option.classes}`}
          >
            <Bars level={i + 1} />
            <span className="text-[13px] font-medium leading-tight">{option.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onVerdict('NOT_SEEN')}
        className="mt-3 w-full rounded-[5px] border border-dashed border-line px-4 py-3 text-[13px] text-ink-faint transition-colors hover:border-line-lit hover:text-ink-dim disabled:opacity-40"
      >
        I haven&apos;t seen this
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint/70">
          Free · doesn&apos;t count
        </span>
      </button>
    </div>
  )
}

/** Four bars, filling left to right, so the scale is visible not just verbal. */
function Bars({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[4px] rounded-[1px] bg-current"
          style={{ height: `${5 + i * 2.5}px`, opacity: i <= level ? 0.95 : 0.22 }}
        />
      ))}
    </span>
  )
}
