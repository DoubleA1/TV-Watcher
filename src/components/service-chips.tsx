'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleService } from '@/app/actions/follow'

type Service = { id: string; name: string; subscribed: boolean }

export function ServiceChips({ services }: { services: Service[] }) {
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(services, (state, id: string) =>
    state.map((s) => (s.id === id ? { ...s, subscribed: !s.subscribed } : s)),
  )

  return (
    <div className="mt-3.5 flex flex-wrap gap-2">
      {optimistic.map((service) => (
        <button
          key={service.id}
          type="button"
          aria-pressed={service.subscribed}
          onClick={() =>
            startTransition(async () => {
              setOptimistic(service.id)
              await toggleService(service.id)
            })
          }
          className={`rounded-[3px] border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
            service.subscribed
              ? 'border-signal-deep glow-signal text-signal'
              : 'border-line text-ink-faint hover:border-line-lit hover:text-ink-dim'
          }`}
        >
          {service.name}
        </button>
      ))}
    </div>
  )
}
