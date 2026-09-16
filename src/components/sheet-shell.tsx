'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Dismiss behaviour for the title overlay.
 *
 * The sheet's content is server-rendered; this only handles the parts that
 * need the browser — Escape, backdrop clicks, locking the page behind it,
 * and moving focus in so keyboard users are not left outside the dialog.
 */
export function SheetShell({
  children,
  closeHref,
}: {
  children: React.ReactNode
  closeHref: string
}) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push(closeHref, { scroll: false })
    }
    document.addEventListener('keydown', onKey)

    // Stop the page underneath scrolling while the sheet is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [router, closeHref])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-void/80 p-[max(12px,var(--gutter))] backdrop-blur-sm"
      onClick={(e) => {
        // Backdrop only — clicks inside the panel must not close it.
        if (e.target === e.currentTarget) router.push(closeHref, { scroll: false })
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Title details"
        tabIndex={-1}
        className="my-6 w-full max-w-[860px] rounded-lg border border-line-lit bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.65)] outline-none"
      >
        {children}
      </div>
    </div>
  )
}
