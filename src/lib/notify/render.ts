import type { EventType, OfferType } from '@/generated/prisma/enums'

export type EventPayload = {
  titleName?: string
  seasonNumber?: number
  episodeNumber?: number
  providerName?: string
  offerType?: OfferType
  newTitleName?: string
  releaseDate?: string | null
}

/**
 * The message itself.
 *
 * This is the product; everything else is scaffolding around it. Two rules:
 * say what it costs the reader ("included with your subscription" is doing
 * real work), and never pad to fill a segment — 160 characters is a segment
 * and a second one costs money for no extra meaning.
 */
export function renderMessage(
  eventType: EventType,
  payload: EventPayload,
  titleName: string,
): { short: string; subject: string } {
  const name = payload.titleName ?? titleName

  switch (eventType) {
    case 'SEASON_PREMIERE': {
      const season = payload.seasonNumber ? ` S${payload.seasonNumber}` : ''
      const where = payload.providerName ? ` on ${payload.providerName}` : ''
      return {
        subject: `${name}${season} is out`,
        short: `${name}${season} is live. Episode 1 just unlocked${where}.`,
      }
    }

    case 'NEW_EPISODE': {
      const code =
        payload.seasonNumber && payload.episodeNumber
          ? `S${String(payload.seasonNumber).padStart(2, '0')}E${String(payload.episodeNumber).padStart(2, '0')}`
          : 'A new episode'
      const where = payload.providerName ? ` on ${payload.providerName}` : ''
      return {
        subject: `${name} ${code}`,
        short: `${name} ${code} is up${where}.`,
      }
    }

    case 'FRANCHISE_ENTRY': {
      const sequel = payload.newTitleName ?? 'A sequel'
      const dated = payload.releaseDate
        ? ` Set for ${new Date(payload.releaseDate).getUTCFullYear()}.`
        : ' No release date yet — we will keep watching.'
      return {
        subject: `${sequel} is happening`,
        short: `${sequel} is happening. It was just added as the next entry in ${name}.${dated}`,
      }
    }

    case 'ARRIVES_ON_MY_SERVICE': {
      const where = payload.providerName ?? 'a service you have'
      const cost =
        payload.offerType === 'FLATRATE'
          ? ' — included with your subscription'
          : payload.offerType === 'ADS'
            ? ' — free with ads'
            : ''
      return {
        subject: `${name} is on ${where}`,
        short: `${name} just landed on ${where}${cost}.`,
      }
    }

    case 'STREAMING_DEBUT': {
      const where = payload.providerName ? ` on ${payload.providerName}` : ''
      const cost = payload.offerType === 'FLATRATE' ? ', included' : ''
      return {
        subject: `${name} is finally streaming`,
        short: `${name} is finally streaming. It landed${where}${cost} — first time it has streamed anywhere.`,
      }
    }
  }
}
