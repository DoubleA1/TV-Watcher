'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/actions/auth'

type Action = (prev: FormState, data: FormData) => Promise<FormState>

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: Action
  submitLabel: string
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {})

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state.ok ? (
        <p
          role="status"
          className="rounded-[4px] border border-signal-deep glow-signal px-3 py-2.5 text-[13px] text-signal"
        >
          Saved.
        </p>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="rounded-[4px] border border-live/35 glow-live px-3 py-2.5 text-[13px] leading-relaxed text-live"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[4px] bg-signal px-5 py-[11px] text-sm font-semibold text-[#04120f] transition-colors hover:bg-[#63ecdd] disabled:opacity-60"
      >
        {pending ? 'Working…' : submitLabel}
      </button>
    </form>
  )
}

export function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-dim"
      >
        {label}
      </label>
      <input id={id} name={id} className="input-console" {...props} />
    </div>
  )
}
