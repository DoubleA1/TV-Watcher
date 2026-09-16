import type { EventType } from '@/generated/prisma/enums'
import type { ReactNode } from 'react'

const ico = (children: ReactNode) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

/**
 * The five event types, described in the reader's language rather than the
 * schema's. Shared by the welcome page and the per-title alert switches so
 * the wording cannot drift between them.
 */
export const SIGNALS: Array<{
  type: EventType
  label: string
  blurb: string
  optIn?: boolean
  icon: ReactNode
}> = [
  {
    type: 'SEASON_PREMIERE',
    label: 'A new season drops',
    blurb:
      'The show you love is back. Premiere dates are published weeks ahead, so this fires on a timer at the exact unlock.',
    icon: ico(<><path d="M3 7h18" /><path d="M5 12h14" /><path d="M7 17h10" /></>),
  },
  {
    type: 'NEW_EPISODE',
    label: 'Every new episode',
    blurb: 'Every week, as it airs. Worth it for the one or two shows you are mid-watch on.',
    optIn: true,
    icon: ico(<><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="2.6" /></>),
  },
  {
    type: 'FRANCHISE_ENTRY',
    label: 'A sequel is announced',
    blurb:
      'A new entry appears in the franchise. You hear it is happening, often long before anyone announces a date.',
    icon: ico(<><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M8 7.5l8 3.2M8 16.5l8-3.2" /></>),
  },
  {
    type: 'ARRIVES_ON_MY_SERVICE',
    label: 'It lands on your service',
    blurb:
      'It moved to something you already subscribe to — included with the subscription, not a rental dressed up as availability.',
    icon: ico(<><path d="M3 5h12v14H3z" /><path d="M21 12h-8" /><path d="M16 8l5 4-5 4" /></>),
  },
  {
    type: 'STREAMING_DEBUT',
    label: 'It finally starts streaming',
    blurb:
      'You saw the trailer eight months ago. It has never been streamable anywhere. Now it is.',
    icon: ico(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.2" /></>),
  },
]

export const SIGNAL_BY_TYPE = new Map(SIGNALS.map((s) => [s.type, s]))
