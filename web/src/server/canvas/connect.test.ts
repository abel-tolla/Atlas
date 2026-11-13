// Connecting Canvas end to end against the real migrations (PGlite) and a
// pretend Canvas: check, save sealed, first sync, reconnect, switch method.

import { randomBytes } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectedAccounts, eventOverrides, events, sourceCalendars, users } from '../../db/schema'
import { createTestDb } from '../../db/testing'
import { open } from '../secrets'
import { syncAccount, type SyncDeps } from '../sync/engine'
import { createCanvasAdapter } from './adapter'
import { ConnectError, checkFeedUrl, connectCanvas, normalizeSchoolUrl } from './connect'
import { FEED, FEED_URL, SCHOOL, fakeCanvas, json, text } from './fixtures'
import { NetworkError } from './http'

const test = await createTestDb()
const { db } = test
const key = randomBytes(32).toString('base64')
const NOW = new Date('2026-11-12T15:00:00Z')
const FEED_PATH = new URL(FEED_URL).pathname

let userId: string

/** A pretend Canvas that answers both ways of connecting with the same data. */
function canvasWith(routes: Parameters<typeof fakeCanvas>[0] = {}) {
  const canvas = fakeCanvas({
    [FEED_PATH]: text(200, FEED),
    '/api/v1/users/self': json(200, { id: 42, name: 'Maya' }),
    '/api/v1/courses': json(200, [{ id: 321, name: 'CS 321' }]),
    '/api/v1/calendar_events': json(200, [
      { id: 'assignment_9001', title: 'Haskell quiz 6', start_at: '2026-11-14T04:59:00Z', context_name: 'CS 321' },
    ]),
    ...routes,
  })
  const sync: SyncDeps = {
    adapters: { canvas: createCanvasAdapter(canvas.get) },
    now: () => NOW,
    retry: { sleep: async () => {} },
    encryptionKey: key,
  }
  return { ...canvas, deps: { get: canvas.get, sync } }
}

const failure = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e as ConnectError)

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(() => test.close())
beforeEach(async () => {
  await test.reset()
  const [user] = await db.insert(users).values({ email: 'maya@example.edu' }).returning()
  userId = user.id
})

describe('checking what the user typed', () => {
  it.each([
    ['canvas.example.edu', 'https://canvas.example.edu'],
    ['https://canvas.example.edu/courses/321', 'https://canvas.example.edu'],
    ['  https://canvas.example.edu/  ', 'https://canvas.example.edu'],
  ])('reads the school address %s', (input, expected) => {
    expect(normalizeSchoolUrl(input)).toBe(expected)
  })

  it('refuses a feed link that isn’t one', () => {
    expect(() => checkFeedUrl('https://canvas.example.edu/calendar')).toThrow(/calendar feed link/)
    expect(() => checkFeedUrl('http://canvas.example.edu/feeds/calendars/user_x.ics')).toThrow(/https/)
    expect(checkFeedUrl(FEED_URL).toString()).toBe(FEED_URL)
  })
})

describe('connecting with a feed link', () => {
  it('saves the connection with the link sealed, then imports courses and deadlines', async () => {
    const canvas = canvasWith()
    const { accountId, sync } = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)

    expect(sync.outcome).toBe('succeeded')
    const [account] = await db.select().from(connectedAccounts)
    expect(account).toMatchObject({
      id: accountId,
      userId,
      provider: 'canvas',
      authType: 'canvas_feed',
      externalAccountId: 'canvas:canvas.example.edu',
      label: 'canvas.example.edu',
      baseUrl: SCHOOL,
      accessTokenEnc: null,
      status: 'active',
    })
    expect(account.feedUrlEnc).not.toContain('pretendSecretFeedToken')
    expect(open(account.feedUrlEnc!, { context: accountId, key })).toBe(FEED_URL)

    expect((await db.select().from(sourceCalendars)).map((c) => c.name).sort()).toEqual([
      'CHEM 101',
      'CS 321',
      'CS 455',
      'First Year Seminar',
    ])
    const deadline = (await db.select().from(events).where(eq(events.externalId, 'assignment_9001')))[0]
    expect(deadline).toMatchObject({
      source: 'canvas',
      kind: 'deadline',
      title: 'Haskell quiz 6',
      courseName: 'CS 321',
      startsAt: new Date('2026-11-14T04:59:00Z'),
    })
  })

  it('updates the same connection when connected again, with no duplicates', async () => {
    const canvas = canvasWith()
    const first = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    const again = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    expect(again.accountId).toBe(first.accountId)
    expect(await db.$count(connectedAccounts)).toBe(1)
    expect(await db.$count(events)).toBe(5)
  })

  it('brings back a connection that needed reconnecting', async () => {
    const canvas = canvasWith()
    const { accountId } = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    await db.update(connectedAccounts).set({ status: 'needs_reconnect', lastError: 'Canvas no longer recognizes…' })
    await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    expect((await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, accountId)))[0]).toMatchObject({
      status: 'active',
      lastError: null,
    })
  })
})

describe('connecting with an access token', () => {
  it('checks the token with Canvas, then saves it sealed and imports', async () => {
    const canvas = canvasWith()
    const { accountId, sync } = await connectCanvas(
      db,
      userId,
      { method: 'token', schoolUrl: 'canvas.example.edu', token: ' tok-secret ' },
      canvas.deps,
    )
    expect(sync.outcome).toBe('succeeded')
    const [account] = await db.select().from(connectedAccounts)
    expect(account).toMatchObject({ authType: 'canvas_token', feedUrlEnc: null, baseUrl: SCHOOL })
    expect(open(account.accessTokenEnc!, { context: accountId, key })).toBe('tok-secret')
    expect(canvas.calls.every((c) => !c.url.includes('tok-secret'))).toBe(true)
    expect((await db.select().from(events)).map((e) => e.externalId)).toEqual(['assignment_9001'])
  })
})

describe('switching between feed link and token', () => {
  it('keeps the same connection, events and the user’s notes', async () => {
    const canvas = canvasWith()
    const { accountId } = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    const [quiz] = await db.select().from(events).where(eq(events.externalId, 'assignment_9001'))
    await db.insert(eventOverrides).values({ eventId: quiz.id, userId, notes: 'Study chapter 7' })

    const switched = await connectCanvas(
      db,
      userId,
      { method: 'token', schoolUrl: SCHOOL, token: 'tok' },
      canvas.deps,
    )
    expect(switched.accountId).toBe(accountId)
    const [account] = await db.select().from(connectedAccounts)
    expect(account).toMatchObject({ authType: 'canvas_token', feedUrlEnc: null })
    const [after] = await db.select().from(events).where(eq(events.externalId, 'assignment_9001'))
    expect(after.id).toBe(quiz.id)
    expect(await db.select().from(eventOverrides)).toMatchObject([{ eventId: quiz.id, notes: 'Study chapter 7' }])
  })
})

describe('when connecting fails, nothing is saved', () => {
  it.each([
    ['a feed link Canvas doesn’t know', { method: 'feed', feedUrl: FEED_URL }, { [FEED_PATH]: text(404, 'Not found') }, 'rejected'],
    ['a page that isn’t a feed', { method: 'feed', feedUrl: FEED_URL }, { [FEED_PATH]: text(200, '<html>Log in</html>') }, 'rejected'],
    ['a refused token', { method: 'token', schoolUrl: SCHOOL, token: 'bad' }, { '/api/v1/users/self': json(401, {}) }, 'rejected'],
    ['a site that isn’t Canvas', { method: 'token', schoolUrl: SCHOOL, token: 'tok' }, { '/api/v1/users/self': text(200, '<html>Hi</html>') }, 'not_canvas'],
    ['a school site that doesn’t answer', { method: 'token', schoolUrl: SCHOOL, token: 'tok' }, { '/api/v1/users/self': new NetworkError('ETIMEDOUT') }, 'unreachable'],
    ['an http address', { method: 'feed', feedUrl: FEED_URL.replace('https', 'http') }, {}, 'unsafe_address'],
    ['a private address', { method: 'token', schoolUrl: 'https://192.168.1.5', token: 'tok' }, {}, 'unsafe_address'],
    ['an empty token', { method: 'token', schoolUrl: SCHOOL, token: '  ' }, {}, 'invalid_input'],
    ['the wrong kind of link', { method: 'feed', feedUrl: `${SCHOOL}/calendar` }, {}, 'not_a_feed'],
  ] as const)('%s', async (_, input, routes, code) => {
    const canvas = canvasWith(routes as Parameters<typeof fakeCanvas>[0])
    const error = await failure(connectCanvas(db, userId, input, canvas.deps))
    expect(error).toBeInstanceOf(ConnectError)
    expect(error?.code).toBe(code)
    expect(error?.message).not.toMatch(/pretendSecretFeedToken|tok-secret/)
    expect(await db.$count(connectedAccounts)).toBe(0)
  })
})

describe('after connecting', () => {
  it('a later sync picks up a changed due date on the same event (#193)', async () => {
    let feed = FEED
    const canvas = canvasWith({ [FEED_PATH]: () => text(200, feed) })
    const { accountId } = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    const [before] = await db.select().from(events).where(eq(events.externalId, 'assignment_9001'))

    feed = FEED.replace('DTSTART:20261114T045900Z', 'DTSTART:20261116T045900Z')
    // A fresh adapter, as a later request would have, so the feed is downloaded again.
    const later = { ...canvas.deps.sync, adapters: { canvas: createCanvasAdapter(canvas.get) } }
    await syncAccount(db, accountId, 'manual', later)
    const [after] = await db.select().from(events).where(eq(events.externalId, 'assignment_9001'))
    expect(after.id).toBe(before.id)
    expect(after.startsAt).toEqual(new Date('2026-11-16T04:59:00Z'))
  })

  it('a revoked feed link asks the user to reconnect, keeping the saved deadlines (#214)', async () => {
    let gone = false
    const canvas = canvasWith({ [FEED_PATH]: () => (gone ? text(404, 'Not found') : text(200, FEED)) })
    const { accountId } = await connectCanvas(db, userId, { method: 'feed', feedUrl: FEED_URL }, canvas.deps)
    gone = true
    const later = { ...canvas.deps.sync, adapters: { canvas: createCanvasAdapter(canvas.get) } }
    const result = await syncAccount(db, accountId, 'daily', later)
    expect(result.outcome).toBe('needs_reconnect')
    expect(result.message).toMatch(/Calendar Feed/)
    const saved = await db.select().from(events).orderBy(asc(events.externalId))
    expect(saved).toHaveLength(5)
    expect(saved.every((e) => e.deletedAt === null)).toBe(true)
  })
})
