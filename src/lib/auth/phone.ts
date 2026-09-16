import parsePhoneNumberFromString from 'libphonenumber-js'

/**
 * Normalise to E.164 (+15551234567).
 *
 * Phone numbers are a unique key here, so "(555) 019-4827" and
 * "+1 555 019 4827" must not become two accounts. Storing anything other
 * than E.164 makes that impossible to guarantee.
 */
export function normalizePhone(input: string, defaultCountry: 'US' = 'US'): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry)
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

/** Display form, for echoing a number back to its owner. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164)
  return parsed?.formatNational() ?? e164
}

/** Last four digits, for confirmations that should not print the whole number. */
export function maskPhone(e164: string): string {
  return `••• ${e164.slice(-4)}`
}
