// Calendar connections, synced events and the user's own layer on top of
// them. See "Schema" in docs/Canvas and Microsoft Sync Plan.md.
//
// The one rule that matters most: sync writes only the synced columns of
// `events`. Everything the user changes lives in `event_overrides` and
// `event_history`, which sync never touches (#64, #88).

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

const at = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const userId = () =>
  text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })

export const provider = pgEnum('provider', ['microsoft', 'canvas', 'google', 'apple'])

/** Where an event came from. Atlas events are made inside Atlas. */
export const eventSource = pgEnum('event_source', ['google', 'microsoft', 'canvas', 'apple', 'atlas'])

export const authType = pgEnum('auth_type', ['oauth', 'canvas_token', 'canvas_feed'])

/** needs_reconnect: the token was rejected, so the user must connect again. */
export const accountStatus = pgEnum('account_status', ['active', 'needs_reconnect', 'error'])

/** A Microsoft or Google calendar, or a Canvas course. */
export const calendarKind = pgEnum('calendar_kind', ['calendar', 'course'])

/** A deadline is a moment, like a Canvas due date. Its start and end are equal. */
export const eventKind = pgEnum('event_kind', ['event', 'deadline'])

export const priority = pgEnum('priority', ['low', 'medium', 'high'])

export const historyKind = pgEnum('history_kind', [
  'created',
  'edited',
  'moved',
  'deleted',
  'removed_at_source',
  'hidden',
  'unhidden',
  'note',
  'priority',
  'importance',
  'overlap',
  'conflict_flagged',
  'conflict_resolved',
])

export const syncTrigger = pgEnum('sync_trigger', ['connect', 'manual', 'daily'])

export const syncStatus = pgEnum('sync_status', ['running', 'succeeded', 'failed'])

/**
 * A calendar connection (Microsoft, Canvas). Separate from the sign-in
 * `accounts` table, so calendar consent never mixes with sign-in (#78).
 *
 * Columns ending in `_enc` hold values sealed by src/server/secrets.ts.
 * They are never sent to the browser (F-40).
 */
export const connectedAccounts = pgTable(
  'connected_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userId(),
    provider: provider('provider').notNull(),
    authType: authType('auth_type').notNull(),
    /** The provider's id for this account: a Microsoft user id or a Canvas user id. */
    externalAccountId: text('external_account_id').notNull(),
    /** What Settings shows, like an email address or a school name. */
    label: text('label').notNull(),
    /** Canvas only: the school's site, like https://canvas.example.edu. */
    baseUrl: text('base_url'),
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    tokenExpiresAt: at('token_expires_at'),
    /** Canvas feed links are secret, so they are sealed like tokens. */
    feedUrlEnc: text('feed_url_enc'),
    scopes: text('scopes'),
    status: accountStatus('status').notNull().default('active'),
    lastSyncedAt: at('last_synced_at'),
    /** For the 60-second Sync Now cooldown, enforced on the server (#66). */
    lastManualSyncAt: at('last_manual_sync_at'),
    /** A readable message for Settings. Never a token or a raw response. */
    lastError: text('last_error'),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('connected_accounts_once').on(t.userId, t.provider, t.externalAccountId),
    index('connected_accounts_user').on(t.userId),
    check(
      'connected_accounts_has_credentials',
      sql`${t.accessTokenEnc} is not null or ${t.feedUrlEnc} is not null`,
    ),
  ],
)

/** The calendars or courses inside a connection, each with a show/hide toggle (#79, #191). */
export const sourceCalendars = pgTable(
  'source_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    kind: calendarKind('kind').notNull().default('calendar'),
    color: text('color'),
    /** Hidden calendars are skipped by sync and left out of the views. */
    visible: boolean('visible').notNull().default(true),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [unique('source_calendars_once').on(t.accountId, t.externalId)],
)

/**
 * One table for synced and Atlas events.
 *
 * Times are stored in UTC. An all-day event is stored from 00:00 UTC on its
 * first day to 00:00 UTC after its last, and read back by its UTC date, so
 * it never shifts a day for someone in another time zone (F-37).
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userId(),
    source: eventSource('source').notNull(),
    /**
     * Null for Atlas events. Set to null if the user disconnects an account
     * but keeps its events (#102).
     */
    sourceCalendarId: uuid('source_calendar_id').references(() => sourceCalendars.id, {
      onDelete: 'set null',
    }),
    /** The provider's id for this event. Null for Atlas events. */
    externalId: text('external_id'),

    // Synced columns: the only ones sync may write.
    title: text('title').notNull(),
    startsAt: at('starts_at').notNull(),
    endsAt: at('ends_at').notNull(),
    allDay: boolean('all_day').notNull().default(false),
    kind: eventKind('kind').notNull().default('event'),
    location: text('location'),
    /** Canvas only. */
    courseName: text('course_name'),
    /** A link to the event in its source app, for "Open in Canvas". */
    sourceUrl: text('source_url'),
    /** Set when the event disappears at the source. Views skip it (#63). */
    deletedAt: at('deleted_at'),
    /** The sync run that last saw this event, used to find removals. */
    lastSeenRunId: uuid('last_seen_run_id'),

    // Atlas events only.
    category: text('category'),
    status: text('status'),

    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Syncing twice can never create a duplicate (#61, #80, #192).
    unique('events_once_per_calendar').on(t.sourceCalendarId, t.externalId),
    // The calendar's range query: events where starts_at < to and ends_at > from.
    index('events_user_starts').on(t.userId, t.startsAt),
    index('events_user_ends').on(t.userId, t.endsAt),
    check('events_end_after_start', sql`${t.endsAt} >= ${t.startsAt}`),
    check(
      'events_external_id_matches_source',
      sql`(${t.source} = 'atlas') = (${t.externalId} is null)`,
    ),
  ],
)

/**
 * The columns of `events` that sync is allowed to write when it updates an
 * event it has seen before. Everything else belongs to Atlas or the user.
 */
export const SYNCED_EVENT_COLUMNS = [
  'title',
  'startsAt',
  'endsAt',
  'allDay',
  'kind',
  'location',
  'courseName',
  'sourceUrl',
  'deletedAt',
  'lastSeenRunId',
  'updatedAt',
] as const satisfies readonly (keyof typeof events.$inferInsert)[]

/** The user's own layer on an event. Sync never writes here (#64, #83). */
export const eventOverrides = pgTable('event_overrides', {
  eventId: uuid('event_id')
    .primaryKey()
    .references(() => events.id, { onDelete: 'cascade' }),
  userId: userId(),
  notes: text('notes'),
  priority: priority('priority'),
  important: boolean('important'),
  hidden: boolean('hidden'),
  overlapFriendly: boolean('overlap_friendly'),
  updatedAt: at('updated_at').notNull().defaultNow(),
})

/**
 * What happened to events: hidden, moved, conflicts and so on (#84). The
 * newest entry that hid an event gives the reason shown in "show hidden".
 */
export const eventHistory = pgTable(
  'event_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userId(),
    /** One entry can involve two events, like a resolved conflict. */
    eventIds: uuid('event_ids').array().notNull(),
    kind: historyKind('kind').notNull(),
    summary: text('summary').notNull(),
    /** The event this entry hid, if any. */
    hid: uuid('hid'),
    at: at('at').notNull().defaultNow(),
  },
  (t) => [
    index('event_history_events').using('gin', t.eventIds),
    index('event_history_user_at').on(t.userId, t.at),
  ],
)

/** Pairs the user marked "both are fine" in the conflict dialog (#93). */
export const acknowledgedConflicts = pgTable(
  'acknowledged_conflicts',
  {
    userId: userId(),
    /** The smaller id of the pair, so each pair is stored once. */
    eventA: uuid('event_a')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    eventB: uuid('event_b')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventA, t.eventB] }),
    check('acknowledged_conflicts_ordered', sql`${t.eventA} < ${t.eventB}`),
  ],
)

export interface SyncCounts {
  fetched: number
  created: number
  updated: number
  removed: number
}

/** One sync of one account: when, why, and how it went (#65). */
export const syncRuns = pgTable(
  'sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: 'cascade' }),
    trigger: syncTrigger('trigger').notNull(),
    status: syncStatus('status').notNull().default('running'),
    startedAt: at('started_at').notNull().defaultNow(),
    finishedAt: at('finished_at'),
    counts: jsonb('counts').$type<SyncCounts>(),
    /** A readable message. Never a token or a raw response. */
    error: text('error'),
  },
  (t) => [index('sync_runs_account_started').on(t.accountId, t.startedAt)],
)

export type ConnectedAccount = typeof connectedAccounts.$inferSelect
export type SourceCalendar = typeof sourceCalendars.$inferSelect
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type EventOverride = typeof eventOverrides.$inferSelect
export type EventHistoryEntry = typeof eventHistory.$inferSelect
export type SyncRun = typeof syncRuns.$inferSelect
