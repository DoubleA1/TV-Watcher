import type { NotificationChannel } from '@/generated/prisma/enums'

export type OutboundMessage = {
  to: string
  subject: string
  body: string
}

export type SendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string; retryable: boolean }

export interface Channel {
  readonly kind: NotificationChannel
  /** False when the channel cannot deliver yet; dispatch suppresses instead
   *  of failing, so a pending carrier registration is not an error state. */
  readonly enabled: boolean
  readonly reason?: string
  send(message: OutboundMessage): Promise<SendResult>
}

/** Development sink. Prints instead of sending, so the pipeline is
 *  observable end to end without any provider account. */
class ConsoleChannel implements Channel {
  readonly enabled = true
  constructor(readonly kind: NotificationChannel) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    console.log(
      `\n  [${this.kind}] → ${message.to}\n  ${message.subject}\n  ${message.body}\n`,
    )
    return { ok: true, providerMessageId: `console-${Date.now()}` }
  }
}

class ResendEmailChannel implements Channel {
  readonly kind = 'EMAIL' as const
  readonly enabled = true

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as { id?: string }
      return { ok: true, providerMessageId: data.id }
    }
    return {
      ok: false,
      error: `Resend ${res.status}: ${await res.text()}`,
      // 5xx and rate limits are worth another go; a 4xx is our mistake.
      retryable: res.status >= 500 || res.status === 429,
    }
  }
}

class TwilioSmsChannel implements Channel {
  readonly kind = 'SMS' as const
  readonly enabled = true

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly messagingServiceSid: string,
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    const body = new URLSearchParams({
      To: message.to,
      MessagingServiceSid: this.messagingServiceSid,
      Body: message.body,
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    )

    if (res.ok) {
      const data = (await res.json()) as { sid?: string }
      return { ok: true, providerMessageId: data.sid }
    }
    return {
      ok: false,
      error: `Twilio ${res.status}: ${await res.text()}`,
      retryable: res.status >= 500 || res.status === 429,
    }
  }
}

/** A channel that exists but cannot deliver yet. */
class DarkChannel implements Channel {
  readonly enabled = false
  constructor(
    readonly kind: NotificationChannel,
    readonly reason: string,
  ) {}

  async send(): Promise<SendResult> {
    return { ok: false, error: this.reason, retryable: false }
  }
}

export function emailChannel(): Channel {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (key && from) return new ResendEmailChannel(key, from)
  return new ConsoleChannel('EMAIL')
}

/**
 * SMS stays dark until Twilio credentials exist.
 *
 * US A2P 10DLC registration takes about a week to approve, and until it
 * clears a trial account can only text numbers you verified by hand. Rather
 * than fail every send in the meantime, dispatch suppresses SMS and falls
 * back to email.
 */
export function smsChannel(): Channel {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

  if (sid && token && service) return new TwilioSmsChannel(sid, token, service)
  if (process.env.NODE_ENV !== 'production') return new ConsoleChannel('SMS')

  return new DarkChannel('SMS', 'SMS is not configured (A2P 10DLC registration pending)')
}
