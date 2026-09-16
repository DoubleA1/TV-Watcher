import bcrypt from 'bcryptjs'

/**
 * Cost 12 is the current sensible default: a few hundred milliseconds on
 * server hardware, which is tolerable for a login and expensive for a
 * cracker. Raise it as hardware improves.
 */
const COST = 12

/** bcrypt silently ignores input past 72 bytes, so reject it rather than
 *  accept a password whose tail does nothing. */
const MAX_BYTES = 72

export async function hashPassword(plain: string): Promise<string> {
  if (Buffer.byteLength(plain, 'utf8') > MAX_BYTES) {
    throw new Error('Password is too long (72 bytes maximum)')
  }
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (Buffer.byteLength(plain, 'utf8') > MAX_BYTES) return false
  return bcrypt.compare(plain, hash)
}
