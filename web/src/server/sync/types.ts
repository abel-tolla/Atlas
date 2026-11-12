// The contract between the sync engine and each provider (Microsoft, Canvas,
// and later Google and Apple). An adapter only talks to its provider and
// translates. Everything else, from the database to retries and removals,
// is the engine's job.

import type { calendarKind, eventKind, provider } from '../../db/schema'

export type Provider = (typeof provider.enumValues)[number]

/** The decrypted credentials of one connected account. Server-only, never logged. */
export interface Credentials {
  accessToken?: string
  refreshToken?: string
  /** Canvas calendar feed link. */
  feedUrl?: string
  /** Canvas school site, like https://canvas.example.edu. */
  baseUrl?: string
}

export interface RefreshedTokens {
  accessToken: string
  /** Providers like Microsoft hand out a new refresh token. Keep it if given. */
  refreshToken?: string
  expiresAt: Date
}

/** A Microsoft calendar or a Canvas course. */
export interface RemoteCalendar {
  externalId: string
  name: string
  kind: (typeof calendarKind.enumValues)[number]
  color?: string
}

/**
 * One event as the provider sees it. Times are instants (UTC). All-day
 * events run from 00:00 UTC on their first day to 00:00 UTC after their last.
 */
export interface RemoteEvent {
  externalId: string
  title: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  kind: (typeof eventKind.enumValues)[number]
  location?: string
  courseName?: string
  sourceUrl?: string
}

export interface SyncWindow {
  from: Date
  to: Date
}

export interface ProviderAdapter {
  listCalendars(credentials: Credentials): Promise<RemoteCalendar[]>
  fetchEvents(
    credentials: Credentials,
    calendar: RemoteCalendar,
    window: SyncWindow,
  ): Promise<RemoteEvent[]>
  /** For OAuth providers. Called when the access token is about to expire. */
  refresh?(credentials: Credentials): Promise<RefreshedTokens>
}

/**
 * The provider refused the credentials: a revoked token, an expired Canvas
 * token, a dead feed link. The user has to connect again (#81, #214).
 */
export class ReauthRequiredError extends Error {
  readonly name = 'ReauthRequiredError'
}

/**
 * The provider didn't answer properly: a 5xx, a timeout, a 429 or a network
 * failure. Worth retrying (#67). If retries run out, the account keeps its
 * cached events and shows "sync delayed".
 */
export class ProviderUnavailableError extends Error {
  readonly name = 'ProviderUnavailableError'
  constructor(
    message: string,
    /** From a Retry-After header, if the provider sent one. */
    readonly retryAfterMs?: number,
  ) {
    super(message)
  }
}

export type SyncTrigger = 'connect' | 'manual' | 'daily'

export interface SyncResult {
  accountId: string
  outcome: 'succeeded' | 'failed' | 'needs_reconnect' | 'skipped'
  /** Readable, safe to show. Never a token or a raw response. */
  message?: string
  counts?: { fetched: number; created: number; updated: number; removed: number }
}
