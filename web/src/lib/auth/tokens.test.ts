import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../../db'
import { emailTokens, users } from '../../db/schema'
import { createTestDb } from '../../test/db'
import { consumeEmailToken, createEmailToken, peekEmailToken, TOKEN_TTL } from './tokens'

let db: Db
let userId: string
const t0 = new Date('2026-01-01T12:00:00Z')

beforeAll(async () => {
  db = await createTestDb()
  ;[{ id: userId }] = await db.insert(users).values({ email: 'a@example.com' }).returning()
})

describe('email tokens', () => {
  it('stores only the hash, never the token', async () => {
    const token = await createEmailToken(db, userId, 'verify', t0)
    const rows = await db.select().from(emailTokens).where(eq(emailTokens.userId, userId))
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).not.toBe(token)
    expect(JSON.stringify(rows)).not.toContain(token)
  })

  it('works once', async () => {
    const token = await createEmailToken(db, userId, 'reset', t0)
    expect(await consumeEmailToken(db, token, 'reset', t0)).toBe(userId)
    expect(await consumeEmailToken(db, token, 'reset', t0)).toBeNull()
  })

  it('refuses a used, expired, unknown or wrong-purpose token', async () => {
    const token = await createEmailToken(db, userId, 'reset', t0)
    const late = new Date(t0.getTime() + TOKEN_TTL.reset + 1)
    expect(await consumeEmailToken(db, token, 'reset', late)).toBeNull()
    expect(await consumeEmailToken(db, token, 'verify', t0)).toBeNull()
    expect(await consumeEmailToken(db, 'nope', 'reset', t0)).toBeNull()
    expect(await consumeEmailToken(db, token, 'reset', t0)).toBe(userId)
  })

  it('stops an older link when a new one is made', async () => {
    const first = await createEmailToken(db, userId, 'verify', t0)
    const second = await createEmailToken(db, userId, 'verify', t0)
    expect(await consumeEmailToken(db, first, 'verify', t0)).toBeNull()
    expect(await consumeEmailToken(db, second, 'verify', t0)).toBe(userId)
  })

  it('lets a page look without using the link', async () => {
    const token = await createEmailToken(db, userId, 'reset', t0)
    expect(await peekEmailToken(db, token, 'reset', t0)).toBe(true)
    expect(await peekEmailToken(db, token, 'reset', t0)).toBe(true)
    await consumeEmailToken(db, token, 'reset', t0)
    expect(await peekEmailToken(db, token, 'reset', t0)).toBe(false)
  })
})
