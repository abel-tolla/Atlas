import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { COMMON_PASSWORDS } from './common-passwords'
import { PASSWORD_MAX, PASSWORD_MIN } from './rules'

export { PASSWORD_MAX, PASSWORD_MIN }

// OWASP's minimum for scrypt is N=2^17. 2^16 keeps a login near 100 ms on a Vercel function.
const N = 2 ** 16
const R = 8
const P = 1
const KEY_LENGTH = 64

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keyLength: number) {
  const options: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r }
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, keyLength, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )
}

/** Format: scrypt$N$r$p$salt$hash. The parameters travel with the hash so they can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P, KEY_LENGTH)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), +n, +r, +p, expected.length)
  return timingSafeEqual(key, expected)
}

let dummy: Promise<string> | undefined
/** A real hash to compare against when the user does not exist, so the timing does not tell. */
export function dummyHash() {
  return (dummy ??= hashPassword('atlas-dummy-password'))
}

export type PasswordProblem = 'too_short' | 'too_long' | 'common'

/** Length and common-password rules only. No forced symbols or digits. */
export function checkPassword(password: string, email = ''): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return 'too_short'
  if (password.length > PASSWORD_MAX) return 'too_long'
  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lower) || (email && lower === email.toLowerCase())) return 'common'
  return null
}
