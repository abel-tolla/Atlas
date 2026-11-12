// A pretend provider for tests: calendars and events live in memory, and a
// test can make any call fail. Only test files import this.

import type {
  Credentials,
  ProviderAdapter,
  RefreshedTokens,
  RemoteCalendar,
  RemoteEvent,
} from './types'

export function fakeProvider() {
  const calendars: RemoteCalendar[] = []
  const eventsByCalendar = new Map<string, RemoteEvent[]>()
  /** Errors to throw, one per call, before answering normally again. */
  const failures = { list: [] as Error[], fetch: [] as Error[], refresh: [] as Error[] }
  const calls = { list: 0, fetch: [] as string[], refresh: 0, credentials: [] as Credentials[] }
  let refreshed: RefreshedTokens | undefined

  const adapter: ProviderAdapter = {
    async listCalendars(credentials) {
      calls.list++
      calls.credentials.push({ ...credentials })
      const failure = failures.list.shift()
      if (failure) throw failure
      return calendars.map((c) => ({ ...c }))
    },
    async fetchEvents(credentials, calendar, window) {
      calls.fetch.push(calendar.externalId)
      calls.credentials.push({ ...credentials })
      const failure = failures.fetch.shift()
      if (failure) throw failure
      // Like a real provider: only what overlaps the window.
      return (eventsByCalendar.get(calendar.externalId) ?? [])
        .filter((e) => e.startsAt < window.to && (e.endsAt > window.from || e.startsAt >= window.from))
        .map((e) => ({ ...e }))
    },
    async refresh() {
      calls.refresh++
      const failure = failures.refresh.shift()
      if (failure) throw failure
      if (!refreshed) throw new Error('The test did not set refreshed tokens.')
      return refreshed
    },
  }

  return {
    adapter,
    calls,
    failures,
    addCalendar(calendar: RemoteCalendar, list: RemoteEvent[] = []) {
      calendars.push(calendar)
      eventsByCalendar.set(calendar.externalId, list)
    },
    removeCalendar(externalId: string) {
      calendars.splice(calendars.findIndex((c) => c.externalId === externalId), 1)
    },
    setEvents(calendarId: string, list: RemoteEvent[]) {
      eventsByCalendar.set(calendarId, list)
    },
    willRefreshTo(tokens: RefreshedTokens) {
      refreshed = tokens
    },
  }
}
