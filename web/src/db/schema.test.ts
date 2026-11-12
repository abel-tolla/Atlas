// Runs the real migrations in PGlite (Postgres in memory) and checks the
// rules the sync engine relies on. No network or Neon branch needed.

import { PGlite } from '@electric-sql/pglite'
import { and, arrayContains, eq, getTableColumns, gt, gte, isNull, lt, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as schema from './schema'
import {
  SYNCED_EVENT_COLUMNS,
  acknowledgedConflicts,
  connectedAccounts,
  eventHistory,
  eventOverrides,
  events,
  sourceCalendars,
  syncRuns,
  users,
  type NewEvent,
} from './schema'

const client = new PGlite()
const db = drizzle({ client, schema })

beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' })
})

afterAll(async () => {
  await client.close()
})

beforeEach(async () => {
  await db.execute(sql`truncate users cascade`)
})

/** Postgres error codes, so tests check the rule that fired, not just "it threw". */
const UNIQUE = '23505'
const CHECK = '23514'

async function failsWith(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: { code?: string; cause?: { code?: string } }) => e,
  )
  expect(error, 'expected the database to refuse this').not.toBeNull()
  expect(error?.cause?.code ?? error?.code).toBe(code)
}

async function seed() {
  const [user] = await db.insert(users).values({ email: 'maya@example.edu', name: 'Maya' }).returning()
  const [account] = await db
    .insert(connectedAccounts)
    .values({
      userId: user.id,
      provider: 'canvas',
      authType: 'canvas_token',
      externalAccountId: '4021',
      label: 'canvas.example.edu',
      baseUrl: 'https://canvas.example.edu',
      accessTokenEnc: 'v1.sealed',
    })
    .returning()
  const [course] = await db
    .insert(sourceCalendars)
    .values({ accountId: account.id, externalId: 'course_321', name: 'CS 321', kind: 'course' })
    .returning()
  return { user, account, course }
}

const assignment = (
  userId: string,
  calendarId: string,
  overrides: Partial<NewEvent> = {},
): NewEvent => ({
  userId,
  source: 'canvas',
  sourceCalendarId: calendarId,
  externalId: 'assignment_9001',
  title: 'Haskell quiz 6',
  startsAt: new Date('2026-11-14T04:59:00Z'),
  endsAt: new Date('2026-11-14T04:59:00Z'),
  kind: 'deadline',
  courseName: 'CS 321',
  ...overrides,
})

/** The upsert the sync engine will use: insert, or update only the synced columns. */
function upsert(rows: NewEvent[]) {
  const columns = getTableColumns(events)
  const set = Object.fromEntries(
    SYNCED_EVENT_COLUMNS.map((key) => [key, sql.raw(`excluded."${columns[key].name}"`)]),
  )
  return db
    .insert(events)
    .values(rows)
    .onConflictDoUpdate({ target: [events.sourceCalendarId, events.externalId], set })
    .returning()
}

describe('migrations', () => {
  it('create every table', async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    )
    // Drizzle keeps its own bookkeeping table in a separate "drizzle" schema.
    // The Login epic adds accounts, auth_sessions, email_tokens, rate_limits and verification_tokens.
    expect(result.rows.map((r) => r.table_name)).toEqual([
      'accounts',
      'acknowledged_conflicts',
      'auth_sessions',
      'connected_accounts',
      'email_tokens',
      'event_history',
      'event_overrides',
      'events',
      'rate_limits',
      'source_calendars',
      'sync_runs',
      'users',
      'verification_tokens',
    ])
  })
})

describe('syncing events', () => {
  // #61, #80, #192: syncing twice never creates duplicates.
  it('updates the same row when an event is synced again', async () => {
    const { user, course } = await seed()
    const [first] = await upsert([assignment(user.id, course.id)])
    const [second] = await upsert([assignment(user.id, course.id)])
    expect(second.id).toBe(first.id)
    expect(await db.$count(events)).toBe(1)
  })

  // #193: a changed due date updates the existing event, and keeps its id
  // so attached tasks stay attached (#194).
  it('moves the event when its due date changes', async () => {
    const { user, course } = await seed()
    const [first] = await upsert([assignment(user.id, course.id)])
    const later = new Date('2026-11-16T04:59:00Z')
    const [moved] = await upsert([assignment(user.id, course.id, { startsAt: later, endsAt: later })])
    expect(moved.id).toBe(first.id)
    expect(moved.startsAt).toEqual(later)
  })

  // #64, #88: sync never undoes the user's own changes.
  it('leaves notes, priority and hidden alone', async () => {
    const { user, course } = await seed()
    const [event] = await upsert([assignment(user.id, course.id)])
    await db.insert(eventOverrides).values({
      eventId: event.id,
      userId: user.id,
      notes: 'Start on Tuesday',
      priority: 'high',
      hidden: true,
    })
    await upsert([assignment(user.id, course.id, { title: 'Haskell quiz 6 (updated)' })])
    const [override] = await db.select().from(eventOverrides)
    expect(override).toMatchObject({ notes: 'Start on Tuesday', priority: 'high', hidden: true })
  })

  it('never lets sync change who owns an event or where it came from', async () => {
    const { user, course } = await seed()
    const [event] = await upsert([assignment(user.id, course.id)])
    await db.update(events).set({ category: 'Study' }).where(eq(events.id, event.id))
    const [again] = await upsert([assignment(user.id, course.id, { category: null, source: 'canvas' })])
    expect(again).toMatchObject({ userId: user.id, source: 'canvas', category: 'Study' })
    expect(SYNCED_EVENT_COLUMNS).not.toContain('userId')
    expect(SYNCED_EVENT_COLUMNS).not.toContain('category')
  })

  it('lets the same provider id appear in two different calendars', async () => {
    const { user, account, course } = await seed()
    const [other] = await db
      .insert(sourceCalendars)
      .values({ accountId: account.id, externalId: 'course_455', name: 'CS 455', kind: 'course' })
      .returning()
    await upsert([assignment(user.id, course.id), assignment(user.id, other.id)])
    expect(await db.$count(events)).toBe(2)
  })
})

describe('rules the database enforces', () => {
  it('refuses an event that ends before it starts', async () => {
    const { user, course } = await seed()
    await failsWith(
      db.insert(events).values(
        assignment(user.id, course.id, {
          startsAt: new Date('2026-11-14T10:00:00Z'),
          endsAt: new Date('2026-11-14T09:00:00Z'),
        }),
      ),
      CHECK,
    )
  })

  it('requires a provider id on synced events and none on Atlas events', async () => {
    const { user, course } = await seed()
    await failsWith(
      db.insert(events).values(assignment(user.id, course.id, { externalId: null })),
      CHECK,
    )
    await failsWith(
      db.insert(events).values({
        userId: user.id,
        source: 'atlas',
        externalId: 'nope',
        title: 'Gym',
        startsAt: new Date('2026-11-04T19:30:00Z'),
        endsAt: new Date('2026-11-04T20:30:00Z'),
      }),
      CHECK,
    )
  })

  it('refuses a connection with no token and no feed link', async () => {
    const { user } = await seed()
    await failsWith(
      db.insert(connectedAccounts).values({
        userId: user.id,
        provider: 'microsoft',
        authType: 'oauth',
        externalAccountId: 'abc',
        label: 'maya@example.edu',
      }),
      CHECK,
    )
  })

  it('stores each connection only once per user', async () => {
    const { user, account } = await seed()
    await failsWith(
      db.insert(connectedAccounts).values({
        userId: user.id,
        provider: account.provider,
        authType: account.authType,
        externalAccountId: account.externalAccountId,
        label: 'again',
        accessTokenEnc: 'v1.sealed',
      }),
      UNIQUE,
    )
  })

  it('stores an acknowledged pair in one order only', async () => {
    const { user, course } = await seed()
    const [a, b] = await upsert([
      assignment(user.id, course.id, { externalId: 'a' }),
      assignment(user.id, course.id, { externalId: 'b' }),
    ])
    const [low, high] = [a.id, b.id].sort()
    await db.insert(acknowledgedConflicts).values({ userId: user.id, eventA: low, eventB: high })
    await failsWith(
      db.insert(acknowledgedConflicts).values({ userId: user.id, eventA: high, eventB: low }),
      CHECK,
    )
  })
})

describe('deleting things', () => {
  // #102: disconnecting and keeping the events leaves them, without a calendar.
  it('keeps events when their account is removed', async () => {
    const { user, account, course } = await seed()
    await upsert([assignment(user.id, course.id)])
    await db.insert(syncRuns).values({ accountId: account.id, trigger: 'connect' })
    await db.delete(connectedAccounts).where(eq(connectedAccounts.id, account.id))

    expect(await db.$count(sourceCalendars)).toBe(0)
    expect(await db.$count(syncRuns)).toBe(0)
    const [kept] = await db.select().from(events)
    expect(kept).toMatchObject({ sourceCalendarId: null, externalId: 'assignment_9001' })
  })

  it('removes everything when a user is deleted', async () => {
    const { user, course } = await seed()
    const [event] = await upsert([assignment(user.id, course.id)])
    await db.insert(eventOverrides).values({ eventId: event.id, userId: user.id, notes: 'x' })
    await db.insert(eventHistory).values({
      userId: user.id,
      eventIds: [event.id],
      kind: 'note',
      summary: 'Note updated',
    })
    await db.delete(users).where(eq(users.id, user.id))
    for (const table of [connectedAccounts, sourceCalendars, events, eventOverrides, eventHistory]) {
      expect(await db.$count(table)).toBe(0)
    }
  })
})

describe('the queries the app will run', () => {
  it('finds the visible, current events in a range', async () => {
    const { user, account, course } = await seed()
    const [hiddenCourse] = await db
      .insert(sourceCalendars)
      .values({ accountId: account.id, externalId: 'course_old', name: 'Old', kind: 'course', visible: false })
      .returning()
    const due = (day: number) => new Date(Date.UTC(2026, 10, day, 4, 59))
    const from = new Date('2026-11-02T00:00:00Z')
    const to = new Date('2026-11-09T00:00:00Z')
    await upsert([
      assignment(user.id, course.id, { externalId: 'in-range', startsAt: due(5), endsAt: due(5) }),
      assignment(user.id, course.id, { externalId: 'due-at-start', startsAt: from, endsAt: from }),
      assignment(user.id, course.id, {
        externalId: 'ends-at-start',
        kind: 'event',
        startsAt: new Date('2026-11-01T23:00:00Z'),
        endsAt: from,
      }),
      assignment(user.id, course.id, { externalId: 'too-late', startsAt: due(20), endsAt: due(20) }),
      assignment(user.id, course.id, { externalId: 'removed', startsAt: due(6), endsAt: due(6), deletedAt: new Date() }),
      assignment(user.id, hiddenCourse.id, { externalId: 'hidden-course', startsAt: due(6), endsAt: due(6) }),
    ])

    // The range rule for every events query: the event starts before the
    // range ends, and either ends after the range starts or starts inside it.
    // The second half lets a zero-length deadline at the very start count,
    // without pulling in an event that merely ends at midnight.
    const rows = await db
      .select({ externalId: events.externalId })
      .from(events)
      .leftJoin(sourceCalendars, eq(events.sourceCalendarId, sourceCalendars.id))
      .where(
        and(
          eq(events.userId, user.id),
          lt(events.startsAt, to),
          or(gt(events.endsAt, from), gte(events.startsAt, from)),
          isNull(events.deletedAt),
          sql`coalesce(${sourceCalendars.visible}, true)`,
        ),
      )
      .orderBy(events.startsAt)
    expect(rows.map((r) => r.externalId)).toEqual(['due-at-start', 'in-range'])
  })

  it('finds an event’s history, including entries shared with another event', async () => {
    const { user, course } = await seed()
    const [a, b] = await upsert([
      assignment(user.id, course.id, { externalId: 'a' }),
      assignment(user.id, course.id, { externalId: 'b' }),
    ])
    await db.insert(eventHistory).values([
      { userId: user.id, eventIds: [a.id], kind: 'note', summary: 'Note updated' },
      { userId: user.id, eventIds: [a.id, b.id], kind: 'conflict_resolved', summary: 'Kept both', hid: null },
    ])
    const forB = await db.select().from(eventHistory).where(arrayContains(eventHistory.eventIds, [b.id]))
    expect(forB.map((h) => h.summary)).toEqual(['Kept both'])
  })
})
