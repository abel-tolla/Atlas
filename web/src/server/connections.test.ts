import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { connectedAccounts, sourceCalendars, users } from '../db/schema'
import { createTestDb } from '../db/testing'
import { listConnections, setCalendarVisible } from './connections'

const test = await createTestDb()
const { db } = test
afterAll(() => test.close())

let maya: string
let daniel: string

beforeEach(async () => {
  await test.reset()
  const rows = await db.insert(users).values([{ email: 'maya@example.edu' }, { email: 'daniel@example.com' }]).returning()
  ;[maya, daniel] = rows.map((r) => r.id)
})

async function canvasFor(userId: string, extra: Partial<typeof connectedAccounts.$inferInsert> = {}) {
  const [account] = await db
    .insert(connectedAccounts)
    .values({
      userId,
      provider: 'canvas',
      authType: 'canvas_feed',
      externalAccountId: 'canvas:canvas.example.edu',
      label: 'canvas.example.edu',
      feedUrlEnc: 'v1.sealed-feed',
      ...extra,
    })
    .returning()
  const [course] = await db
    .insert(sourceCalendars)
    .values({ accountId: account.id, externalId: 'course_321', name: 'CS 321', kind: 'course' })
    .returning()
  return { account, course }
}

describe('listConnections', () => {
  it('shows a user only their own connections, with no secrets', async () => {
    const { account, course } = await canvasFor(maya)
    await canvasFor(daniel)
    const list = await listConnections(db, maya)
    expect(list).toEqual([
      {
        id: account.id,
        provider: 'canvas',
        method: 'feed',
        label: 'canvas.example.edu',
        state: 'ok',
        message: null,
        lastSyncedAt: null,
        calendars: [{ id: course.id, name: 'CS 321', kind: 'course', visible: true }],
      },
    ])
    expect(JSON.stringify(list)).not.toContain('sealed')
  })

  it.each([
    [{ status: 'active' as const, lastError: 'Canvas isn’t answering' }, 'delayed'],
    [{ status: 'needs_reconnect' as const, lastError: 'Copy the link again' }, 'needs_reconnect'],
    [{ status: 'error' as const, lastError: 'Something went wrong' }, 'error'],
  ])('describes %o as %s', async (status, state) => {
    await canvasFor(maya, status)
    const [connection] = await listConnections(db, maya)
    expect(connection).toMatchObject({ state, message: status.lastError })
  })

  it('is empty for a user with no connections', async () => {
    expect(await listConnections(db, maya)).toEqual([])
  })
})

describe('setCalendarVisible (#191)', () => {
  it('hides and shows a course', async () => {
    const { account, course } = await canvasFor(maya)
    expect(await setCalendarVisible(db, maya, account.id, course.id, false)).toBe(true)
    expect((await listConnections(db, maya))[0].calendars[0].visible).toBe(false)
    expect(await setCalendarVisible(db, maya, account.id, course.id, true)).toBe(true)
  })

  it('refuses to touch another user’s course', async () => {
    const theirs = await canvasFor(daniel)
    expect(await setCalendarVisible(db, maya, theirs.account.id, theirs.course.id, false)).toBe(false)
    expect((await listConnections(db, daniel))[0].calendars[0].visible).toBe(true)
  })

  it('refuses a course that belongs to a different connection', async () => {
    const mine = await canvasFor(maya)
    const theirs = await canvasFor(daniel)
    expect(await setCalendarVisible(db, maya, mine.account.id, theirs.course.id, false)).toBe(false)
  })
})
