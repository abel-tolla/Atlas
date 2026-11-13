// Connecting Canvas (#190): with a calendar feed link, or with the school's
// Canvas address and a personal access token. Many schools turn access
// tokens off, so the feed link is the one most students will use.
//
// The connection is checked against Canvas before anything is saved, its
// secret is sealed to the account, and the first sync runs right away.

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { connectedAccounts } from '../../db/schema'
import type { Database } from '../../db/types'
import { seal } from '../secrets'
import { syncAccount, type SyncDeps } from '../sync/engine'
import { ProviderUnavailableError, ReauthRequiredError, type SyncResult } from '../sync/types'
import { fetchFeed, fetchSelf } from './api'
import { UnsafeAddressError, checkAddress, httpsGet, type HttpGet } from './http'

export type CanvasConnectInput =
  | { method: 'feed'; feedUrl: string }
  | { method: 'token'; schoolUrl: string; token: string }

export type ConnectErrorCode =
  | 'invalid_input'
  | 'unsafe_address'
  | 'not_a_feed'
  | 'not_canvas'
  | 'rejected'
  | 'unreachable'

/** Something the user can fix. The message is safe to show. */
export class ConnectError extends Error {
  readonly name = 'ConnectError'
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** "canvas.school.edu", "https://canvas.school.edu/courses/1" → "https://canvas.school.edu". */
export function normalizeSchoolUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new ConnectError('invalid_input', 'Enter your school’s Canvas address.')
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return checked(withScheme).origin
}

/** A Canvas feed link looks like https://<school>/feeds/calendars/user_<…>.ics. */
export function checkFeedUrl(input: string): URL {
  const url = checked(input.trim())
  if (!/^\/feeds\/calendars\/[^/]+\.ics$/.test(url.pathname)) {
    throw new ConnectError(
      'not_a_feed',
      'That doesn’t look like a Canvas calendar feed link. In Canvas, open Calendar, choose Calendar Feed, and copy the whole link.',
    )
  }
  return url
}

function checked(raw: string): URL {
  try {
    return checkAddress(raw)
  } catch (error) {
    if (error instanceof UnsafeAddressError) throw new ConnectError('unsafe_address', error.message)
    throw error
  }
}

export interface ConnectDeps {
  sync: SyncDeps
  get?: HttpGet
}

/** Turns a failed check into a message for the form. */
function explain(error: unknown, rejected: string): never {
  if (error instanceof ConnectError) throw error
  if (error instanceof ReauthRequiredError) throw new ConnectError('rejected', rejected)
  if (error instanceof ProviderUnavailableError) {
    throw new ConnectError('unreachable', 'Your school’s Canvas didn’t answer. Check the address and try again.')
  }
  throw error
}

export async function connectCanvas(
  db: Database,
  userId: string,
  input: CanvasConnectInput,
  deps: ConnectDeps,
): Promise<{ accountId: string; sync: SyncResult }> {
  const get = deps.get ?? httpsGet
  let site: URL
  let secret: { feedUrl: string } | { token: string }

  if (input.method === 'feed') {
    const url = checkFeedUrl(input.feedUrl ?? '')
    try {
      await fetchFeed(get, url.toString())
    } catch (error) {
      explain(error, 'Canvas didn’t recognize that feed link. Copy it again from Calendar → Calendar Feed.')
    }
    site = url
    secret = { feedUrl: url.toString() }
  } else {
    const token = (input.token ?? '').trim()
    if (!token) throw new ConnectError('invalid_input', 'Paste the access token you made in Canvas.')
    const baseUrl = normalizeSchoolUrl(input.schoolUrl ?? '')
    let self
    try {
      self = await fetchSelf(get, baseUrl, token)
    } catch (error) {
      explain(error, 'Canvas didn’t accept that access token. Check you copied all of it, or make a new one.')
    }
    if (!self) {
      throw new ConnectError('not_canvas', 'That address doesn’t look like a Canvas site. Use the address you see when you log in to Canvas.')
    }
    site = new URL(baseUrl)
    secret = { token }
  }
  const label = site.hostname

  // One Canvas connection per school per user, whichever way it connects,
  // so switching between feed link and token keeps the same events.
  const externalAccountId = `canvas:${site.hostname}`
  const [existing] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, 'canvas'),
        eq(connectedAccounts.externalAccountId, externalAccountId),
      ),
    )
  const id = existing?.id ?? randomUUID()
  const options = { context: id, key: deps.sync.encryptionKey }
  const credentials = {
    authType: 'feedUrl' in secret ? ('canvas_feed' as const) : ('canvas_token' as const),
    label,
    baseUrl: site.origin,
    feedUrlEnc: 'feedUrl' in secret ? seal(secret.feedUrl, options) : null,
    accessTokenEnc: 'token' in secret ? seal(secret.token, options) : null,
    refreshTokenEnc: null,
    tokenExpiresAt: null,
    status: 'active' as const,
    lastError: null,
    updatedAt: new Date(),
  }

  await db
    .insert(connectedAccounts)
    .values({ id, userId, provider: 'canvas', externalAccountId, ...credentials })
    .onConflictDoUpdate({
      target: [connectedAccounts.userId, connectedAccounts.provider, connectedAccounts.externalAccountId],
      set: credentials,
    })

  return { accountId: id, sync: await syncAccount(db, id, 'connect', deps.sync) }
}
