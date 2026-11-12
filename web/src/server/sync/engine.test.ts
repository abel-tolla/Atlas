// The sync engine against the real migrations in PGlite, with a fake
// provider. Each test names the issue whose "done when" it checks.

import { randomBytes, randomUUID } from 'node:crypto'
import { addDays, addMinutes, addSeconds } from 'date-fns'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SYNCED_EVENT_COLUMNS,
  connectedAccounts,
  eventHistory,
  eventOverrides,
  events,
  sourceCalendars,
  syncRuns,
  users,
} from '../../db/schema'
import { createTestDb } from '../../db/testing'
import { open, seal } from '../secrets'
import {
  CooldownError,
  WINDOW_DAYS_AHEAD,
  WINDOW_DAYS_BACK,
  syncAccount,
  syncAllAccounts,
  syncNow,
  syncWindow,
  type SyncDeps,
} from './engine'
import { fakeProvider } from './fakeProvider'
import { withRetry } from './retry'
import { ProviderUnavailableError, ReauthRequiredError, type RemoteEvent } from './types'

const test = await createTestDb()
const { db } = test
const key = randomBytes(32).toString('base64')
const NOW = new Date('2026-11-12T15:00:00Z')

let clock: Date
let fake: ReturnType<typeof fakeProvider>
let deps: SyncDeps
let userId: string

beforeAll(() => {
  // The engine logs unexpected failures. Keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(() => test.close())

beforeEach(async () => {
  await test.reset()
  clock = NOW
  fake = fakeProvider()
  deps = {
    adapters: { microsoft: fake.adapter, canvas: fake.adapter },
    now: () => clock,
    retry: { sleep: async () => {} },
    encryptionKey: key,
  }
  const [user] = await db.insert(users).values({ email: 'maya@example.edu' }).returning()
  userId = user.id
})

/** A connected account with tokens sealed to its id, like the real connect flow. */
async function connect(
  provider: 'microsoft' | 'canvas' = 'microsoft',
  { expiresAt = addDays(NOW, 1), refreshToken = 'refresh-1', forUser = userId } = {},
) {
  const id = randomUUID()
  const options = { context: id, key }
  await db.insert(connectedAccounts).values({
    id,
    userId: forUser,
    provider,
    authType: provider === 'canvas' ? 'canvas_token' : 'oauth',
    externalAccountId: `ext-${id}`,
    label: provider,
    accessTokenEnc: seal('access-1', options),
    refreshTokenEnc: provider === 'microsoft' ? seal(refreshToken, options) : null,
    tokenExpiresAt: provider === 'microsoft' ? expiresAt : null,
  })
  return id
}

const at = (days: number, hour = 14) => addMinutes(addDays(NOW, days), (hour - 15) * 60)
const meeting = (id: string, days = 1, extra: Partial<RemoteEvent> = {}): RemoteEvent => ({
  externalId: id,
  title: `Meeting ${id}`,
  startsAt: at(days),
  endsAt: addMinutes(at(days), 60),
  allDay: false,
  kind: 'event',
  ...extra,
})
const work = { externalId: 'work', name: 'Work', kind: 'calendar' as const }

const allEvents = () => db.select().from(events).orderBy(asc(events.externalId))
const accountRow = async (id: string) =>
  (await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, id)))[0]

describe('syncWindow (#62)', () => {
  it('reaches 60 days back and 180 days ahead', () => {
    const { from, to } = syncWindow(NOW)
    expect(from).toEqual(addDays(NOW, -WINDOW_DAYS_BACK))
    expect(to).toEqual(addDays(NOW, WINDOW_DAYS_AHEAD))
    expect([WINDOW_DAYS_BACK, WINDOW_DAYS_AHEAD]).toEqual([60, 180])
  })
})

describe('importing (#61, #80)', () => {
  it('saves calendars and events, and records the run', async () => {
    fake.addCalendar(work, [meeting('a'), meeting('b', 2)])
    const id = await connect()
    const result = await syncAccount(db, id, 'connect', deps)

    expect(result).toMatchObject({
      outcome: 'succeeded',
      counts: { fetched: 2, created: 2, updated: 0, removed: 0 },
    })
    expect((await allEvents()).map((e) => [e.externalId, e.source, e.userId])).toEqual([
      ['a', 'microsoft', userId],
      ['b', 'microsoft', userId],
    ])
    expect(await db.select().from(sourceCalendars)).toMatchObject([{ name: 'Work', visible: true }])
    expect(await db.select().from(syncRuns)).toMatchObject([
      { trigger: 'connect', status: 'succeeded', counts: result.counts, error: null },
    ])
    expect(await accountRow(id)).toMatchObject({
      status: 'active',
      lastSyncedAt: NOW,
      lastError: null,
      syncLockedUntil: null,
    })
  })

  it('never creates duplicates when syncing again', async () => {
    fake.addCalendar(work, [meeting('a'), meeting('b', 2)])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)
    const again = await syncAccount(db, id, 'manual', deps)
    expect(again.counts).toEqual({ fetched: 2, created: 0, updated: 2, removed: 0 })
    expect(await db.$count(events)).toBe(2)
  })

  it('keeps one copy when the provider lists an event twice', async () => {
    fake.addCalendar(work, [meeting('a'), meeting('a')])
    const id = await connect()
    expect((await syncAccount(db, id, 'connect', deps)).outcome).toBe('succeeded')
    expect(await db.$count(events)).toBe(1)
  })

  it('handles a calendar bigger than one insert batch', async () => {
    fake.addCalendar(work, Array.from({ length: 1201 }, (_, i) => meeting(`m${i}`, (i % 170) + 1)))
    const id = await connect()
    const result = await syncAccount(db, id, 'connect', deps)
    expect(result.counts?.created).toBe(1201)
    expect(await db.$count(events)).toBe(1201)
  })

  it('stores all-day events and deadlines as given', async () => {
    const day = new Date('2026-11-20T00:00:00Z')
    const due = new Date('2026-11-21T04:59:00Z')
    fake.addCalendar(work, [
      meeting('holiday', 0, { startsAt: day, endsAt: addDays(day, 1), allDay: true }),
      meeting('quiz', 0, { startsAt: due, endsAt: due, kind: 'deadline', courseName: 'CS 321' }),
    ])
    await syncAccount(db, await connect(), 'connect', deps)
    expect(await allEvents()).toMatchObject([
      { externalId: 'holiday', startsAt: day, endsAt: addDays(day, 1), allDay: true },
      { externalId: 'quiz', startsAt: due, endsAt: due, kind: 'deadline', courseName: 'CS 321' },
    ])
  })

  it('repairs an event that ends before it starts instead of failing the sync', async () => {
    fake.addCalendar(work, [meeting('odd', 1, { endsAt: at(1, 10) })])
    expect((await syncAccount(db, await connect(), 'connect', deps)).outcome).toBe('succeeded')
    const [odd] = await allEvents()
    expect(odd.endsAt).toEqual(odd.startsAt)
  })
})

describe('picking up changes and removals (#63, #193)', () => {
  it('updates the same row when an event changes', async () => {
    fake.addCalendar(work, [meeting('a')])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)
    const [before] = await allEvents()

    fake.setEvents('work', [meeting('a', 3, { title: 'Moved meeting', location: 'Room 2' })])
    await syncAccount(db, id, 'manual', deps)
    const [after] = await allEvents()
    expect(after).toMatchObject({ id: before.id, title: 'Moved meeting', location: 'Room 2', startsAt: at(3) })
  })

  it('marks events gone from the provider as removed, with a history entry', async () => {
    fake.addCalendar(work, [meeting('a'), meeting('b', 2)])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)

    fake.setEvents('work', [meeting('a')])
    const result = await syncAccount(db, id, 'manual', deps)
    expect(result.counts?.removed).toBe(1)
    const b = (await allEvents()).find((e) => e.externalId === 'b')!
    expect(b.deletedAt).toEqual(NOW)
    expect(await db.select().from(eventHistory)).toMatchObject([
      { eventIds: [b.id], kind: 'removed_at_source', summary: 'Removed in Outlook', userId },
    ])
  })

  it('brings an event back if the provider lists it again', async () => {
    fake.addCalendar(work, [meeting('a')])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)
    fake.setEvents('work', [])
    await syncAccount(db, id, 'manual', deps)
    fake.setEvents('work', [meeting('a')])
    await syncAccount(db, id, 'manual', deps)
    expect((await allEvents())[0].deletedAt).toBeNull()
  })

  it('leaves events outside the window alone, since they were never asked for', async () => {
    fake.addCalendar(work, [meeting('old', -30)])
    const id = await connect('microsoft', { expiresAt: addDays(NOW, 90) })
    await syncAccount(db, id, 'connect', deps)

    // Two months later, the old event has slid out of the window.
    clock = addDays(NOW, 60)
    const result = await syncAccount(db, id, 'daily', deps)
    expect(result.outcome).toBe('succeeded')
    expect(result.counts?.removed).toBe(0)
    expect((await allEvents())[0].deletedAt).toBeNull()
  })
})

describe('the user’s own changes (#64, #88)', () => {
  it('survive any number of syncs, including the event changing', async () => {
    fake.addCalendar(work, [meeting('a')])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)
    const [event] = await allEvents()
    await db.insert(eventOverrides).values({
      eventId: event.id,
      userId,
      notes: 'Bring the slides',
      priority: 'high',
      hidden: true,
      important: true,
      overlapFriendly: true,
    })

    fake.setEvents('work', [meeting('a', 4, { title: 'Renamed' })])
    await syncAccount(db, id, 'manual', deps)
    await syncAccount(db, id, 'daily', deps)

    expect(await db.select().from(eventOverrides)).toMatchObject([
      { eventId: event.id, notes: 'Bring the slides', priority: 'high', hidden: true, important: true, overlapFriendly: true },
    ])
  })
})

describe('columns sync doesn’t own', () => {
  it('are never changed by a re-sync, only the synced ones are', async () => {
    fake.addCalendar(work, [meeting('a')])
    // A token good for a month, so moving the clock a day doesn't trigger a refresh.
    const id = await connect('microsoft', { expiresAt: addDays(NOW, 30) })
    await syncAccount(db, id, 'connect', deps)
    await db.update(events).set({ category: 'Work', status: 'Needs check' })
    const [before] = await allEvents()

    clock = addDays(NOW, 1)
    fake.setEvents('work', [meeting('a', 5, { title: 'Changed', location: 'Elsewhere' })])
    expect((await syncAccount(db, id, 'daily', deps)).outcome).toBe('succeeded')
    const [after] = await allEvents()

    const synced = new Set<string>(SYNCED_EVENT_COLUMNS)
    const untouched = Object.keys(before).filter((column) => !synced.has(column))
    expect(untouched).toEqual(expect.arrayContaining(['id', 'userId', 'source', 'category', 'status', 'createdAt']))
    for (const column of untouched) {
      expect(after[column as keyof typeof after], column).toEqual(before[column as keyof typeof before])
    }
    expect(after).toMatchObject({ title: 'Changed', location: 'Elsewhere', updatedAt: clock })
  })
})

describe('calendars and courses (#79, #191)', () => {
  it('skips a hidden calendar and leaves its events as they are', async () => {
    fake.addCalendar(work, [meeting('a')])
    fake.addCalendar({ externalId: 'birthdays', name: 'Birthdays', kind: 'calendar' }, [meeting('bday')])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)
    await db.update(sourceCalendars).set({ visible: false }).where(eq(sourceCalendars.externalId, 'birthdays'))

    fake.calls.fetch.length = 0
    fake.setEvents('birthdays', [])
    await syncAccount(db, id, 'manual', deps)
    expect(fake.calls.fetch).toEqual(['work'])
    expect((await allEvents()).find((e) => e.externalId === 'bday')?.deletedAt).toBeNull()
  })

  it('keeps the user’s toggle when the provider renames a calendar', async () => {
    fake.addCalendar(work, [])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)
    await db.update(sourceCalendars).set({ visible: false })
    fake.removeCalendar('work')
    fake.addCalendar({ ...work, name: 'Work (renamed)' })
    await syncAccount(db, id, 'manual', deps)
    expect(await db.select().from(sourceCalendars)).toMatchObject([{ name: 'Work (renamed)', visible: false }])
  })

  it('keeps a calendar the provider stops listing, like a finished course', async () => {
    fake.addCalendar({ externalId: 'cs321', name: 'CS 321', kind: 'course' }, [
      meeting('quiz', 2, { kind: 'deadline', endsAt: at(2) }),
    ])
    const id = await connect('canvas')
    await syncAccount(db, id, 'connect', deps)
    fake.removeCalendar('cs321')
    await syncAccount(db, id, 'daily', deps)
    expect(await db.$count(sourceCalendars)).toBe(1)
    expect((await allEvents())[0].deletedAt).toBeNull()
  })
})

describe('when a provider has trouble (#67)', () => {
  it('retries and then succeeds', async () => {
    fake.addCalendar(work, [meeting('a')])
    fake.failures.fetch.push(new ProviderUnavailableError('503'), new ProviderUnavailableError('503'))
    const result = await syncAccount(db, await connect(), 'daily', deps)
    expect(result.outcome).toBe('succeeded')
    expect(fake.calls.fetch).toHaveLength(3)
  })

  it('keeps the saved events and says the sync is delayed once retries run out', async () => {
    fake.addCalendar(work, [meeting('a')])
    const id = await connect()
    await syncAccount(db, id, 'connect', deps)

    fake.failures.list.push(...Array.from({ length: 3 }, () => new ProviderUnavailableError('down')))
    const result = await syncAccount(db, id, 'daily', deps)
    expect(result).toMatchObject({ outcome: 'failed', message: expect.stringMatching(/Outlook isn’t answering/) })
    expect(await accountRow(id)).toMatchObject({ status: 'active', lastError: result.message, syncLockedUntil: null })
    expect((await allEvents())[0].deletedAt).toBeNull()
    expect((await db.select().from(syncRuns)).at(-1)).toMatchObject({ status: 'failed', error: result.message })
  })

  it('asks the user to reconnect when the token is refused, without retrying', async () => {
    fake.addCalendar(work, [meeting('a')])
    fake.failures.list.push(new ReauthRequiredError('Your Canvas token was revoked or expired.'))
    const id = await connect('canvas')
    const result = await syncAccount(db, id, 'daily', deps)
    expect(result).toMatchObject({ outcome: 'needs_reconnect', message: 'Your Canvas token was revoked or expired.' })
    expect(fake.calls.list).toBe(1)
    expect((await accountRow(id)).status).toBe('needs_reconnect')
  })

  it('never shows the raw error of an unexpected failure', async () => {
    fake.addCalendar(work, [])
    fake.failures.list.push(new Error('TypeError at line 42 with secret-token-xyz'))
    const id = await connect()
    const result = await syncAccount(db, id, 'daily', deps)
    expect(result.message).toBe('Something went wrong while syncing Outlook. Your saved events are still showing.')
    expect((await accountRow(id)).status).toBe('error')
    expect(JSON.stringify(await db.select().from(syncRuns))).not.toContain('secret-token-xyz')
  })

  it('fails clearly for a provider with no adapter yet', async () => {
    deps.adapters = {}
    const result = await syncAccount(db, await connect(), 'daily', deps)
    expect(result.outcome).toBe('failed')
  })
})

describe('tokens (#81)', () => {
  it('opens the stored tokens for the adapter', async () => {
    fake.addCalendar(work, [])
    await syncAccount(db, await connect(), 'connect', deps)
    expect(fake.calls.credentials[0]).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    expect(fake.calls.refresh).toBe(0)
  })

  it('refreshes a token that is about to expire, and saves the new ones sealed', async () => {
    fake.addCalendar(work, [])
    fake.willRefreshTo({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: addMinutes(NOW, 60) })
    const id = await connect('microsoft', { expiresAt: addMinutes(NOW, 2) })
    await syncAccount(db, id, 'daily', deps)

    expect(fake.calls.refresh).toBe(1)
    expect(fake.calls.credentials[0].accessToken).toBe('access-2')
    const row = await accountRow(id)
    expect(row.accessTokenEnc).not.toContain('access-2')
    expect(open(row.accessTokenEnc!, { context: id, key })).toBe('access-2')
    expect(open(row.refreshTokenEnc!, { context: id, key })).toBe('refresh-2')
    expect(row.tokenExpiresAt).toEqual(addMinutes(NOW, 60))
  })

  it('asks the user to reconnect when the refresh is refused', async () => {
    fake.addCalendar(work, [meeting('a')])
    fake.failures.refresh.push(new ReauthRequiredError('Reconnect Outlook to keep syncing.'))
    const id = await connect('microsoft', { expiresAt: addMinutes(NOW, -5) })
    const result = await syncAccount(db, id, 'daily', deps)
    expect(result.outcome).toBe('needs_reconnect')
    expect(fake.calls.list).toBe(0)
  })
})

describe('one sync at a time', () => {
  it('skips an account another sync is working on', async () => {
    const id = await connect()
    await db.update(connectedAccounts).set({ syncLockedUntil: addMinutes(NOW, 5) })
    expect(await syncAccount(db, id, 'manual', deps)).toMatchObject({ outcome: 'skipped' })
    expect(await db.$count(syncRuns)).toBe(0)
  })

  it('takes over a lock left behind by a sync that died', async () => {
    fake.addCalendar(work, [])
    const id = await connect()
    await db.update(connectedAccounts).set({ syncLockedUntil: addMinutes(NOW, -1) })
    expect((await syncAccount(db, id, 'daily', deps)).outcome).toBe('succeeded')
  })
})

describe('daily sync (#65)', () => {
  it('syncs every account, and one failing doesn’t stop the others', async () => {
    fake.addCalendar(work, [meeting('a')])
    const broken = await connect('microsoft')
    const fine = await connect('canvas')
    const waiting = await connect('microsoft')
    await db.update(connectedAccounts).set({ status: 'needs_reconnect' }).where(eq(connectedAccounts.id, waiting))
    // The first call made (whichever account goes first) fails for good.
    fake.failures.list.push(new Error('boom'))

    const results = await syncAllAccounts(db, deps)
    expect(results.map((r) => r.accountId).sort()).toEqual([broken, fine].sort())
    expect(results.map((r) => r.outcome).sort()).toEqual(['failed', 'succeeded'])
  })
})

describe('Sync Now (#66)', () => {
  it('syncs all of a user’s accounts', async () => {
    fake.addCalendar(work, [meeting('a')])
    await connect('microsoft')
    await connect('canvas')
    const results = await syncNow(db, userId, deps)
    expect(results.map((r) => r.outcome)).toEqual(['succeeded', 'succeeded'])
  })

  it('refuses a second press within 60 seconds, saying how long to wait', async () => {
    fake.addCalendar(work, [])
    await connect()
    await syncNow(db, userId, deps)

    clock = addSeconds(NOW, 45)
    const error = await syncNow(db, userId, deps).catch((e) => e)
    expect(error).toBeInstanceOf(CooldownError)
    expect(error.retryAfterSeconds).toBe(15)

    clock = addSeconds(NOW, 60)
    expect(await syncNow(db, userId, deps)).toHaveLength(1)
  })

  it('lets only one of two simultaneous presses through', async () => {
    fake.addCalendar(work, [])
    await connect()
    const outcomes = await Promise.allSettled([syncNow(db, userId, deps), syncNow(db, userId, deps)])
    expect(outcomes.map((o) => o.status).sort()).toEqual(['fulfilled', 'rejected'])
  })

  it('reports an account that needs reconnecting instead of syncing it', async () => {
    const id = await connect()
    await db.update(connectedAccounts).set({ status: 'needs_reconnect' })
    expect(await syncNow(db, userId, deps)).toEqual([
      { accountId: id, outcome: 'needs_reconnect', message: 'Reconnect Outlook to sync it again.' },
    ])
  })

  it('does nothing for a user with no connections', async () => {
    expect(await syncNow(db, userId, deps)).toEqual([])
  })

  it('only touches the user’s own accounts', async () => {
    const [other] = await db.insert(users).values({ email: 'daniel@example.com' }).returning()
    fake.addCalendar(work, [meeting('a')])
    await connect('microsoft', { forUser: other.id })
    expect(await syncNow(db, userId, deps)).toEqual([])
    expect(await db.$count(events)).toBe(0)
  })
})

describe('withRetry', () => {
  it('waits longer each time, and honours Retry-After up to a cap', async () => {
    const waits: number[] = []
    const sleep = async (ms: number) => void waits.push(ms)
    let calls = 0
    await withRetry(
      async () => {
        calls++
        if (calls === 1) throw new ProviderUnavailableError('503')
        if (calls === 2) throw new ProviderUnavailableError('429', 60_000)
        return 'ok'
      },
      { sleep, attempts: 3, baseDelayMs: 1000, maxDelayMs: 10_000 },
    )
    expect(waits).toEqual([1000, 10_000])
  })

  it('does not retry other errors', async () => {
    let calls = 0
    await expect(
      withRetry(async () => {
        calls++
        throw new ReauthRequiredError('no')
      }, { sleep: async () => {} }),
    ).rejects.toBeInstanceOf(ReauthRequiredError)
    expect(calls).toBe(1)
  })
})
