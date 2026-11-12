import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../../db'
import { authSessions, users } from '../../db/schema'
import { createTestDb } from '../../test/db'
import {
  checkSession,
  createSession,
  deleteSession,
  deleteUserSessions,
  SESSION_MAX_AGE_MS,
} from './sessions'

let db: Db
let userId: string
const t0 = new Date('2026-01-01T12:00:00Z')

beforeAll(async () => {
  db = await createTestDb()
  ;[{ id: userId }] = await db.insert(users).values({ email: 's@example.com' }).returning()
})

describe('server-side sessions', () => {
  it('is valid until log out, and log out ends it at once (#210)', async () => {
    const id = await createSession(db, userId, { userAgent: 'test' }, t0)
    expect(await checkSession(db, id, t0)).toBe(true)
    await deleteSession(db, id)
    expect(await checkSession(db, id, t0)).toBe(false)
  })

  it('refuses an unknown id', async () => {
    expect(await checkSession(db, 'not-a-session', t0)).toBe(false)
  })

  it('expires after 30 days and removes the row', async () => {
    const id = await createSession(db, userId, {}, t0)
    const late = new Date(t0.getTime() + SESSION_MAX_AGE_MS + 1)
    expect(await checkSession(db, id, late)).toBe(false)
    expect(await db.select().from(authSessions).where(eq(authSessions.id, id))).toHaveLength(0)
  })

  it('slides the expiry forward while the user is active, not on every request', async () => {
    const id = await createSession(db, userId, {}, t0)
    const soon = new Date(t0.getTime() + 60 * 60 * 1000)
    await checkSession(db, id, soon)
    const [same] = await db.select().from(authSessions).where(eq(authSessions.id, id))
    expect(same.expiresAt.getTime()).toBe(t0.getTime() + SESSION_MAX_AGE_MS)

    const nextDay = new Date(t0.getTime() + 2 * 24 * 60 * 60 * 1000)
    await checkSession(db, id, nextDay)
    const [moved] = await db.select().from(authSessions).where(eq(authSessions.id, id))
    expect(moved.expiresAt.getTime()).toBe(nextDay.getTime() + SESSION_MAX_AGE_MS)
  })

  it('signs a user out everywhere, or everywhere else', async () => {
    const a = await createSession(db, userId, {}, t0)
    const b = await createSession(db, userId, {}, t0)
    await deleteUserSessions(db, userId, a)
    expect(await checkSession(db, a, t0)).toBe(true)
    expect(await checkSession(db, b, t0)).toBe(false)
    await deleteUserSessions(db, userId)
    expect(await checkSession(db, a, t0)).toBe(false)
  })
})
