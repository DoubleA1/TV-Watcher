'use client'

import { useOptimistic, useTransition } from 'react'
import { setAlert } from '@/app/actions/follow'
import { SIGNALS } from '@/components/signals'
import type { EventType } from '@/generated/prisma/enums'

type Rule = { eventType: EventType; enabled: boolean }

/**
 * The five alert switches.
 *
 * Optimistic so a toggle feels instant; the server action is the source of
 * truth and a failure snaps the switch back rather than lying about it.
 */
export function AlertSwitches({ titleId, rules }: { titleId: string; rules: Rule[] }) {
  const [, startTransition] = useTransition()
  const byType = new Map(rules.map((r) => [r.eventType, r.enabled]))

  const [optimistic, setOptimistic] = useOptimistic(
    SIGNALS.map((s) => ({
      ...s,
      enabled: byType.get(s.type) ?? !s.optIn,
    })),
    (state, next: { type: EventType; enabled: boolean }) =>
      state.map((s) => (s.type === next.type ? { ...s, enabled: next.enabled } : s)),
  )

  return (
    <div>
      {optimistic.map((signal) => (
        <div
          key={signal.type}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-4 last:border-b-0"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
              {signal.label}
              {signal.optIn ? (
                <span className="rounded-[3px] border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                  Off by default
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{signal.blurb}</div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={signal.enabled}
            aria-label={signal.label}
            onClick={() =>
              startTransition(async () => {
                setOptimistic({ type: signal.type, enabled: !signal.enabled })
                await setAlert(titleId, signal.type, !signal.enabled)
              })
            }
            className={`relative h-6 w-[42px] shrink-0 rounded-xl border transition-colors ${
              signal.enabled
                ? 'border-signal-deep glow-signal'
                : 'border-line-lit bg-panel-3'
            }`}
          >
            <span
              className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full transition-transform ${
                signal.enabled ? 'translate-x-[18px] bg-signal' : 'bg-ink-faint'
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  )
}
