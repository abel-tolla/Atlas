// Talking to Canvas: the REST API (with an access token) and the calendar
// feed link. Every answer is turned into the sync engine's two errors, so
// the engine knows whether to retry or to ask the user to reconnect.
// Messages never contain the token or the feed link (#214).

import { ProviderUnavailableError, ReauthRequiredError, type RemoteCalendar, type RemoteEvent, type SyncWindow } from '../sync/types'
import { FeedFormatError, parseCanvasFeed, type ParsedFeed } from './feed'
import { NetworkError, UnsafeAddressError, type HttpGet, type HttpResponse } from './http'

const UNREACHABLE = 'Your school’s Canvas isn’t answering right now. Your saved assignments are still showing.'
const MAX_PAGES = 50

export const TOKEN_REJECTED =
  'Canvas didn’t accept your access token. It may have expired or been deleted. Make a new one in Canvas and connect again.'
export const FEED_REJECTED =
  'Canvas no longer recognizes your calendar feed link. Copy it again from Calendar → Calendar Feed and connect again.'

/** Calls Canvas, turning network trouble into the engine's errors. */
async function call(get: HttpGet, url: string, headers?: Record<string, string>) {
  try {
    return await get(url, headers)
  } catch (error) {
    if (error instanceof UnsafeAddressError) {
      throw new ReauthRequiredError('Atlas can’t safely reach that Canvas address any more. Connect Canvas again.')
    }
    if (error instanceof NetworkError) throw new ProviderUnavailableError(UNREACHABLE)
    throw error
  }
}

function retryAfterMs(res: HttpResponse) {
  const seconds = Number(res.headers['retry-after'])
  return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/** Throws for answers that stop the sync. Returns false for "skip this one". */
function ok(res: HttpResponse, rejected: string): boolean {
  if (res.status >= 200 && res.status < 300) return true
  if (res.status === 401) throw new ReauthRequiredError(rejected)
  // Canvas signals its rate limit with a 403 and this text.
  if (res.status === 429 || (res.status === 403 && /rate limit exceeded/i.test(res.body))) {
    throw new ProviderUnavailableError(UNREACHABLE, retryAfterMs(res))
  }
  if (res.status >= 500) throw new ProviderUnavailableError(UNREACHABLE, retryAfterMs(res))
  return false
}

/** The URL of the next page, from Canvas's Link header, if it stays on the same site. */
function nextPage(res: HttpResponse, current: string) {
  const link = res.headers.link
  const header = Array.isArray(link) ? link.join(',') : link
  const next = header?.split(',').map((part) => /<([^>]+)>;\s*rel="next"/.exec(part)?.[1]).find(Boolean)
  if (!next) return undefined
  const url = new URL(next, current)
  return url.origin === new URL(current).origin ? url.toString() : undefined
}

function parseJson<T>(res: HttpResponse): T {
  try {
    return JSON.parse(res.body) as T
  } catch {
    throw new ProviderUnavailableError(UNREACHABLE)
  }
}

/** Every page of a list. Returns null if Canvas said the list isn't available (403/404). */
async function getAll<T>(get: HttpGet, baseUrl: string, path: string, token: string): Promise<T[] | null> {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json' }
  const items: T[] = []
  let url: string | undefined = new URL(path, baseUrl).toString()
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await call(get, url, headers)
    if (!ok(res, TOKEN_REJECTED)) return page === 0 ? null : items
    items.push(...parseJson<T[]>(res))
    url = nextPage(res, url)
  }
  return items
}

// With an access token

interface CanvasUser {
  id: number
  name?: string
}

/** Checks a token. Returns the Canvas user, or null if the site doesn't look like Canvas. */
export async function fetchSelf(get: HttpGet, baseUrl: string, token: string): Promise<CanvasUser | null> {
  const res = await call(get, new URL('/api/v1/users/self', baseUrl).toString(), {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
  })
  if (!ok(res, TOKEN_REJECTED)) return null
  try {
    const user = JSON.parse(res.body) as CanvasUser
    return typeof user?.id === 'number' ? user : null
  } catch {
    return null
  }
}

interface CanvasCourse {
  id: number
  name?: string
  access_restricted_by_date?: boolean
}

export async function fetchCourses(get: HttpGet, baseUrl: string, token: string): Promise<RemoteCalendar[]> {
  const courses = await getAll<CanvasCourse>(get, baseUrl, '/api/v1/courses?enrollment_state=active&per_page=100', token)
  return (courses ?? [])
    .filter((c) => c.name && !c.access_restricted_by_date)
    .map((c) => ({ externalId: `course_${c.id}`, name: c.name!, kind: 'course' as const }))
}

interface CanvasCalendarEvent {
  id: string
  title?: string
  start_at?: string | null
  all_day?: boolean
  html_url?: string
  context_name?: string
  assignment?: { due_at?: string | null; html_url?: string }
}

/**
 * A course's assignments due inside the window. Canvas's calendar events
 * endpoint gives each student their own due date, including extensions.
 */
export async function fetchAssignments(
  get: HttpGet,
  baseUrl: string,
  token: string,
  course: RemoteCalendar,
  window: SyncWindow,
): Promise<RemoteEvent[]> {
  const query = new URLSearchParams({
    type: 'assignment',
    'context_codes[]': course.externalId,
    start_date: window.from.toISOString(),
    end_date: window.to.toISOString(),
    per_page: '100',
  })
  // A course the student can't see any more is skipped, not an error.
  const items = await getAll<CanvasCalendarEvent>(get, baseUrl, `/api/v1/calendar_events?${query}`, token)
  return (items ?? []).flatMap((item) => {
    const due = item.assignment?.due_at ?? item.start_at
    if (!due) return [] // No due date: nothing to put on a calendar.
    const at = new Date(due)
    return [
      {
        externalId: item.id,
        title: item.title || '(No title)',
        startsAt: at,
        endsAt: at,
        allDay: false,
        kind: 'deadline' as const,
        courseName: item.context_name ?? course.name,
        sourceUrl: item.assignment?.html_url ?? item.html_url,
      },
    ]
  })
}

// With a calendar feed link

export async function fetchFeed(get: HttpGet, feedUrl: string): Promise<ParsedFeed> {
  const res = await call(get, feedUrl, { accept: 'text/calendar' })
  if (!ok(res, FEED_REJECTED)) throw new ReauthRequiredError(FEED_REJECTED)
  try {
    return parseCanvasFeed(res.body)
  } catch (error) {
    if (error instanceof FeedFormatError) throw new ReauthRequiredError(FEED_REJECTED)
    throw error
  }
}
