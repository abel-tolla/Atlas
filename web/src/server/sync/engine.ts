// The sync engine (Sync Events epic #9). It pulls events from a connected
// account into the shared events table and keeps them current, the same way
// for every provider. See "Part B" in docs/Canvas and Microsoft Sync Plan.md.
//
// Rules it keeps:
// - Syncing twice never creates a duplicate (#61): rows are upserted on
//   (source_calendar_id, external_id).
// - Sync writes only the synced columns, so the user's own changes in
//   event_overrides always survive (#64, #88).
// - Events removed at the source get deleted_at, never a real delete, so
//   their notes and attached tasks are kept (#63).
// - A failure leaves the last events in place (#67).

import { addDays } from 'date-fns'
import {
  and,
  eq,
  getTableColumns,
  gt,
  gte,
  isNull,
  lt,
  lte,
  max,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import {
  SYNCED_EVENT_COLUMNS,
  connectedAccounts,
  eventHistory,
  events,
  sourceCalendars,
  syncRuns,
  type ConnectedAccount,
  type NewEvent,
  type SourceCalendar,
} from '../../db/schema'
import type { Database } from '../../db/types'
import { open, seal } from '../secrets'
import { withRetry, type RetryOptions } from './retry'
import {
  ProviderUnavailableError,
  ReauthRequiredError,
  type Credentials,
  type Provider,
  type ProviderAdapter,
  type RemoteCalendar,
  type RemoteEvent,
  type SyncResult,
  type SyncTrigger,
  type SyncWindow,
} from './types'

/** The rolling window synced events come from (#62). */
export const WINDOW_DAYS_BACK = 60
export const WINDOW_DAYS_AHEAD = 180
/** Sync Now can run once a minute per user (#66). */
export const MANUAL_COOLDOWN_MS = 60_000
/** Refresh an access token this long before it expires (#81). */
export const REFRESH_MARGIN_MS = 5 * 60_000
/** How long one sync may hold an account before another may start. */
export const LOCK_MS = 10 * 60_000
/** Rows per insert, well under Postgres's parameter limit. */
const BATCH_SIZE = 500

const LABEL: Record<Provider, string> = {
  microsoft: 'Outlook',
  canvas: 'Canvas',
  google: 'Google Calendar',
  apple: 'Apple Calendar',
}

export interface SyncDeps {
  adapters: Partial<Record<Provider, ProviderAdapter>>
  /** The clock. Tests pass a fixed one. */
  now?: () => Date
  retry?: RetryOptions
  /** Defaults to TOKEN_ENCRYPTION_KEY. Tests pass their own. */
  encryptionKey?: string
}

export function syncWindow(now: Date): SyncWindow {
  return { from: addDays(now, -WINDOW_DAYS_BACK), to: addDays(now, WINDOW_DAYS_AHEAD) }
}

/** Sync Now was pressed again within the cooldown (#66). */
export class CooldownError extends Error {
  readonly name = 'CooldownError'
  constructor(readonly retryAfterSeconds: number) {
    super(`Synced a moment ago. Try again in ${retryAfterSeconds} seconds.`)
  }
}

/**
 * Syncs one connected account. Never throws for provider problems: the
 * outcome, a safe message and the counts come back in the result, and are
 * saved on the account and in sync_runs.
 */
export async function syncAccount(
  db: Database,
  accountId: string,
  trigger: SyncTrigger,
  deps: SyncDeps,
): Promise<SyncResult> {
  const now = deps.now?.() ?? new Date()
  const account = await claimLock(db, accountId, now)
  if (!account) {
    const exists = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId))
    return {
      accountId,
      outcome: 'skipped',
      message: exists.length
        ? 'A sync of this account is already running.'
        : 'This connection no longer exists.',
    }
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ accountId, trigger, startedAt: now })
    .returning({ id: syncRuns.id })
  const counts = { fetched: 0, created: 0, updated: 0, removed: 0 }

  try {
    const adapter = deps.adapters[account.provider]
    if (!adapter) throw new Error(`No sync adapter for ${account.provider} yet.`)
    const call = <T>(work: () => Promise<T>) => withRetry(work, deps.retry)

    const credentials = await freshCredentials(db, account, adapter, now, deps)
    const remote = unique(await call(() => adapter.listCalendars(credentials)), (c) => c.externalId)
    const calendars = await saveCalendars(db, account, remote)
    const window = syncWindow(now)

    for (const { remote: remoteCalendar, local } of calendars) {
      // Hidden calendars are skipped, and their events are left as they are (#79, #191).
      if (!local.visible) continue
      const remoteEvents = await call(() =>
        adapter.fetchEvents(credentials, remoteCalendar, window),
      )
      counts.fetched += remoteEvents.length
      await saveEvents(db, account, local, remoteEvents, run.id, window, now, counts)
    }

    await db
      .update(syncRuns)
      .set({ status: 'succeeded', finishedAt: now, counts })
      .where(eq(syncRuns.id, run.id))
    await db
      .update(connectedAccounts)
      .set({ status: 'active', lastError: null, lastSyncedAt: now, updatedAt: now })
      .where(eq(connectedAccounts.id, account.id))
    return { accountId, outcome: 'succeeded', counts }
  } catch (error) {
    const failure = describeFailure(error, account.provider)
    if (failure.unexpected) {
      // The message only. Adapters must never put credentials in errors.
      console.error(`[sync] account ${account.id} failed:`, (error as Error).message)
    }
    await db
      .update(syncRuns)
      .set({ status: 'failed', finishedAt: now, counts, error: failure.message })
      .where(eq(syncRuns.id, run.id))
    await db
      .update(connectedAccounts)
      .set({ status: failure.accountStatus, lastError: failure.message, updatedAt: now })
      .where(eq(connectedAccounts.id, account.id))
    return { accountId, outcome: failure.outcome, message: failure.message, counts }
  } finally {
    await db
      .update(connectedAccounts)
      .set({ syncLockedUntil: null })
      .where(eq(connectedAccounts.id, account.id))
  }
}

/**
 * The daily background sync (#65). Every account that isn't waiting for
 * the user to reconnect, one at a time. One failing never stops the others.
 */
export async function syncAllAccounts(db: Database, deps: SyncDeps): Promise<SyncResult[]> {
  const accounts = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(ne(connectedAccounts.status, 'needs_reconnect'))
  const results: SyncResult[] = []
  for (const { id } of accounts) {
    try {
      results.push(await syncAccount(db, id, 'daily', deps))
    } catch (error) {
      console.error(`[sync] daily sync of ${id} failed:`, (error as Error).message)
      results.push({ accountId: id, outcome: 'failed', message: 'Sync stopped unexpectedly.' })
    }
  }
  return results
}

/**
 * Sync Now (#66): syncs all of a user's accounts, at most once a minute.
 * The cooldown is claimed in the same statement that checks it, so two
 * quick requests can't both get through. Throws CooldownError if too soon.
 */
export async function syncNow(db: Database, userId: string, deps: SyncDeps): Promise<SyncResult[]> {
  const now = deps.now?.() ?? new Date()
  const claimed = await db
    .update(connectedAccounts)
    .set({ lastManualSyncAt: now })
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        or(
          isNull(connectedAccounts.lastManualSyncAt),
          lte(connectedAccounts.lastManualSyncAt, new Date(now.getTime() - MANUAL_COOLDOWN_MS)),
        ),
      ),
    )
    .returning({ id: connectedAccounts.id, provider: connectedAccounts.provider, status: connectedAccounts.status })

  if (claimed.length === 0) {
    const [{ latest }] = await db
      .select({ latest: max(connectedAccounts.lastManualSyncAt) })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId))
    if (!latest) return [] // No connected accounts: nothing to sync.
    const waitMs = latest.getTime() + MANUAL_COOLDOWN_MS - now.getTime()
    throw new CooldownError(Math.max(1, Math.ceil(waitMs / 1000)))
  }

  const results: SyncResult[] = []
  for (const account of claimed) {
    if (account.status === 'needs_reconnect') {
      results.push({
        accountId: account.id,
        outcome: 'needs_reconnect',
        message: `Reconnect ${LABEL[account.provider]} to sync it again.`,
      })
      continue
    }
    results.push(await syncAccount(db, account.id, 'manual', deps))
  }
  return results
}

// Steps of one sync

/** Takes the account's lock, or returns undefined if another sync holds it. */
async function claimLock(db: Database, accountId: string, now: Date) {
  const [account] = await db
    .update(connectedAccounts)
    .set({ syncLockedUntil: new Date(now.getTime() + LOCK_MS) })
    .where(
      and(
        eq(connectedAccounts.id, accountId),
        or(isNull(connectedAccounts.syncLockedUntil), lt(connectedAccounts.syncLockedUntil, now)),
      ),
    )
    .returning()
  return account as ConnectedAccount | undefined
}

/** Opens the stored credentials, refreshing the access token if it's about to expire. */
async function freshCredentials(
  db: Database,
  account: ConnectedAccount,
  adapter: ProviderAdapter,
  now: Date,
  deps: SyncDeps,
): Promise<Credentials> {
  const options = { context: account.id, key: deps.encryptionKey }
  const reveal = (value: string | null) => (value ? open(value, options) : undefined)
  const credentials: Credentials = {
    accessToken: reveal(account.accessTokenEnc),
    refreshToken: reveal(account.refreshTokenEnc),
    feedUrl: reveal(account.feedUrlEnc),
    baseUrl: account.baseUrl ?? undefined,
  }

  const expiresSoon =
    !account.tokenExpiresAt || account.tokenExpiresAt.getTime() - now.getTime() < REFRESH_MARGIN_MS
  if (!adapter.refresh || !credentials.refreshToken || !expiresSoon) return credentials

  const tokens = await withRetry(() => adapter.refresh!(credentials), deps.retry)
  credentials.accessToken = tokens.accessToken
  credentials.refreshToken = tokens.refreshToken ?? credentials.refreshToken
  await db
    .update(connectedAccounts)
    .set({
      accessTokenEnc: seal(tokens.accessToken, options),
      refreshTokenEnc: tokens.refreshToken ? seal(tokens.refreshToken, options) : account.refreshTokenEnc,
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: now,
    })
    .where(eq(connectedAccounts.id, account.id))
  return credentials
}

/**
 * Saves the provider's calendars or courses. New ones are visible; existing
 * ones keep the user's toggle. A calendar the provider no longer lists is
 * left alone with its events, since a finished course's deadlines are
 * still worth seeing. It just stops being synced.
 */
async function saveCalendars(db: Database, account: ConnectedAccount, remote: RemoteCalendar[]) {
  if (remote.length > 0) {
    await db
      .insert(sourceCalendars)
      .values(
        remote.map((c) => ({
          accountId: account.id,
          externalId: c.externalId,
          name: c.name,
          kind: c.kind,
          color: c.color ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [sourceCalendars.accountId, sourceCalendars.externalId],
        set: {
          name: sql`excluded.name`,
          kind: sql`excluded.kind`,
          color: sql`excluded.color`,
        },
      })
  }
  const local = await db
    .select()
    .from(sourceCalendars)
    .where(eq(sourceCalendars.accountId, account.id))
  const byId = new Map(local.map((c) => [c.externalId, c]))
  return remote.map((c) => ({ remote: c, local: byId.get(c.externalId)! }))
}

/** The SET clause of the upsert: only the synced columns, from the incoming row. */
const syncedColumnsFromIncoming = (() => {
  const columns = getTableColumns(events)
  return Object.fromEntries(
    SYNCED_EVENT_COLUMNS.map((key) => [key, sql.raw(`excluded."${columns[key].name}"`)]),
  )
})()

/**
 * Upserts one calendar's events, then marks the ones the provider no longer
 * has as removed. Both happen in one transaction, so the calendar is never
 * seen half updated.
 */
async function saveEvents(
  db: Database,
  account: ConnectedAccount,
  calendar: SourceCalendar,
  remote: RemoteEvent[],
  runId: string,
  window: SyncWindow,
  now: Date,
  counts: NonNullable<SyncResult['counts']>,
) {
  const rows: NewEvent[] = unique(remote, (e) => e.externalId).map((e) => ({
    userId: account.userId,
    source: account.provider,
    sourceCalendarId: calendar.id,
    externalId: e.externalId,
    title: e.title.trim() || '(No title)',
    startsAt: e.startsAt,
    // A provider glitch must not fail the whole sync on the end-after-start rule.
    endsAt: e.endsAt < e.startsAt ? e.startsAt : e.endsAt,
    allDay: e.allDay,
    kind: e.kind,
    location: e.location ?? null,
    courseName: e.courseName ?? null,
    sourceUrl: e.sourceUrl ?? null,
    // Seen again, so not removed, even if an earlier sync thought it was.
    deletedAt: null,
    lastSeenRunId: runId,
    updatedAt: now,
  }))

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const saved = await tx
        .insert(events)
        .values(rows.slice(i, i + BATCH_SIZE))
        .onConflictDoUpdate({
          target: [events.sourceCalendarId, events.externalId],
          set: syncedColumnsFromIncoming,
        })
        // xmax is 0 only for a row this statement inserted.
        .returning({ inserted: sql<boolean>`(xmax = 0)` })
      for (const row of saved) {
        if (row.inserted) counts.created++
        else counts.updated++
      }
    }

    // Removed at the source: in this calendar and inside the window (the
    // same overlap rule the app's queries use), but not seen in this run.
    // Events outside the window weren't asked for, so they are left alone.
    const removed = await tx
      .update(events)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(events.sourceCalendarId, calendar.id),
          isNull(events.deletedAt),
          or(isNull(events.lastSeenRunId), ne(events.lastSeenRunId, runId)),
          lt(events.startsAt, window.to),
          or(gt(events.endsAt, window.from), gte(events.startsAt, window.from)),
        ),
      )
      .returning({ id: events.id })
    if (removed.length > 0) {
      await tx.insert(eventHistory).values(
        removed.map(({ id }) => ({
          userId: account.userId,
          eventIds: [id],
          kind: 'removed_at_source' as const,
          summary: `Removed in ${LABEL[account.provider]}`,
          at: now,
        })),
      )
      counts.removed += removed.length
    }
  })
}

function describeFailure(error: unknown, provider: Provider) {
  const label = LABEL[provider]
  if (error instanceof ReauthRequiredError) {
    return {
      outcome: 'needs_reconnect' as const,
      accountStatus: 'needs_reconnect' as const,
      message: error.message || `Reconnect ${label} to keep syncing.`,
      unexpected: false,
    }
  }
  if (error instanceof ProviderUnavailableError) {
    // Still connected, just delayed: the views show "sync delayed" (#67).
    return {
      outcome: 'failed' as const,
      accountStatus: 'active' as const,
      message: `${label} isn’t answering right now. Your saved events are still showing.`,
      unexpected: false,
    }
  }
  return {
    outcome: 'failed' as const,
    accountStatus: 'error' as const,
    message: `Something went wrong while syncing ${label}. Your saved events are still showing.`,
    unexpected: true,
  }
}

/** Keeps the first of each id. Upserting the same key twice in one statement is an error. */
function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = key(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}
