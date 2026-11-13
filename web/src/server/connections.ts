// What Settings → Connections shows, and the course and calendar toggles
// (#79, #191). Every query is scoped to the signed-in user, and nothing
// secret ever leaves the server.

import { and, asc, eq, inArray } from 'drizzle-orm'
import { connectedAccounts, sourceCalendars } from '../db/schema'
import type { Database } from '../db/types'

/** delayed: still connected, but the last sync couldn't reach the provider. */
export type ConnectionState = 'ok' | 'delayed' | 'needs_reconnect' | 'error'

export interface ConnectionView {
  id: string
  provider: string
  method: 'feed' | 'token' | 'oauth'
  label: string
  state: ConnectionState
  /** Safe to show. Never a token or a raw response. */
  message: string | null
  lastSyncedAt: string | null
  calendars: { id: string; name: string; kind: string; visible: boolean }[]
}

const METHOD = { canvas_feed: 'feed', canvas_token: 'token', oauth: 'oauth' } as const

export async function listConnections(db: Database, userId: string): Promise<ConnectionView[]> {
  const accounts = await db
    .select({
      id: connectedAccounts.id,
      provider: connectedAccounts.provider,
      authType: connectedAccounts.authType,
      label: connectedAccounts.label,
      status: connectedAccounts.status,
      lastError: connectedAccounts.lastError,
      lastSyncedAt: connectedAccounts.lastSyncedAt,
    })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId))
    .orderBy(asc(connectedAccounts.createdAt))
  if (accounts.length === 0) return []

  const calendars = await db
    .select({
      id: sourceCalendars.id,
      accountId: sourceCalendars.accountId,
      name: sourceCalendars.name,
      kind: sourceCalendars.kind,
      visible: sourceCalendars.visible,
    })
    .from(sourceCalendars)
    .where(inArray(sourceCalendars.accountId, accounts.map((a) => a.id)))
    .orderBy(asc(sourceCalendars.name))

  return accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    method: METHOD[a.authType],
    label: a.label,
    state:
      a.status === 'needs_reconnect'
        ? 'needs_reconnect'
        : a.status === 'error'
          ? 'error'
          : a.lastError
            ? 'delayed'
            : 'ok',
    message: a.lastError,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    calendars: calendars
      .filter((c) => c.accountId === a.id)
      .map(({ id, name, kind, visible }) => ({ id, name, kind, visible })),
  }))
}

/**
 * Shows or hides one calendar or course. Returns false if it isn't one of
 * this user's, so a guessed id can't touch someone else's calendar.
 */
export async function setCalendarVisible(
  db: Database,
  userId: string,
  accountId: string,
  calendarId: string,
  visible: boolean,
): Promise<boolean> {
  const owned = db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
  const updated = await db
    .update(sourceCalendars)
    .set({ visible })
    .where(and(eq(sourceCalendars.id, calendarId), inArray(sourceCalendars.accountId, owned)))
    .returning({ id: sourceCalendars.id })
  return updated.length === 1
}
