// The Canvas adapter for the sync engine. One adapter serves both ways of
// connecting: the REST API with an access token, or the calendar feed link.

import type { ProviderAdapter } from '../sync/types'
import { ReauthRequiredError } from '../sync/types'
import { fetchAssignments, fetchCourses, fetchFeed } from './api'
import type { ParsedFeed } from './feed'
import { httpsGet, type HttpGet } from './http'

/** A sync asks for the course list, then each course: download the feed once for all of them. */
const FEED_REUSE_MS = 60_000

export function createCanvasAdapter(get: HttpGet = httpsGet): ProviderAdapter {
  const feeds = new Map<string, { at: number; feed: Promise<ParsedFeed> }>()

  function feedFor(url: string) {
    const now = Date.now()
    for (const [key, entry] of feeds) if (now - entry.at > FEED_REUSE_MS) feeds.delete(key)
    let entry = feeds.get(url)
    if (!entry) {
      entry = { at: now, feed: fetchFeed(get, url) }
      // A failed download isn't reused: the next try fetches again.
      entry.feed.catch(() => feeds.delete(url))
      feeds.set(url, entry)
    }
    return entry.feed
  }

  const missing = () =>
    new ReauthRequiredError('This Canvas connection is missing its feed link or token. Connect Canvas again.')

  return {
    async listCalendars(credentials) {
      if (credentials.feedUrl) return (await feedFor(credentials.feedUrl)).courses
      if (credentials.accessToken && credentials.baseUrl) {
        return fetchCourses(get, credentials.baseUrl, credentials.accessToken)
      }
      throw missing()
    },

    async fetchEvents(credentials, course, window) {
      if (credentials.feedUrl) {
        const feed = await feedFor(credentials.feedUrl)
        // The feed holds everything. Keep what the window covers, like the API does.
        return (feed.assignments.get(course.externalId) ?? []).filter(
          (e) => e.startsAt < window.to && (e.endsAt > window.from || e.startsAt >= window.from),
        )
      }
      if (credentials.accessToken && credentials.baseUrl) {
        return fetchAssignments(get, credentials.baseUrl, credentials.accessToken, course, window)
      }
      throw missing()
    },
  }
}
