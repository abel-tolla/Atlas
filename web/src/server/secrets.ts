// Seals calendar tokens and Canvas feed links before they are stored, and
// opens them only inside server code that calls the provider (F-40).
//
// AES-256-GCM with a fresh random IV for every value. GCM also detects any
// change to the stored value, so a tampered token fails to open instead of
// being used.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const IV_BYTES = 12

function loadKey(raw = process.env.TOKEN_ENCRYPTION_KEY) {
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set. See .env.example.')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be 32 bytes in base64. Make one with: openssl rand -base64 32',
    )
  }
  return key
}

export interface SealOptions {
  /**
   * Ties the sealed value to one place, like a connected account's id.
   * A value copied into another row then fails to open.
   */
  context?: string
  /** For tests. Defaults to TOKEN_ENCRYPTION_KEY. */
  key?: string
}

/** Returns "v1.<iv>.<tag>.<ciphertext>", safe to store in a text column. */
export function seal(plain: string, { context = '', key }: SealOptions = {}) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', loadKey(key), iv)
  cipher.setAAD(Buffer.from(context))
  const sealed = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [VERSION, iv, cipher.getAuthTag(), sealed].map((part) =>
    typeof part === 'string' ? part : part.toString('base64url'),
  ).join('.')
}

/** Opens a value from seal(). Throws if it was changed or sealed for another context. */
export function open(value: string, { context = '', key }: SealOptions = {}) {
  const [version, iv, tag, sealed] = value.split('.')
  if (version !== VERSION || !iv || !tag || sealed === undefined) {
    throw new Error('This value was not sealed by Atlas.')
  }
  const decipher = createDecipheriv('aes-256-gcm', loadKey(key), Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(context))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(sealed, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
