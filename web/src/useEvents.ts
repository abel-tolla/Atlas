import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  getEvents,
  getVersion,
  mockMode,
  subscribe,
  type DateRange,
  type EventsResult,
} from './calendarApi'

interface Loaded {
  key: string
  result?: EventsResult
  error?: string
}

/**
 * Loads the events in a range, and reloads them after any change. While a
 * new range loads, `loading` is true and the views show placeholders. After
 * an edit, the old events stay on screen until the new ones arrive.
 */
export function useEvents(range: DateRange) {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion)
  const key = `${range.start.getTime()}-${range.end.getTime()}`
  const [loaded, setLoaded] = useState<Loaded>({ key: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const startedAt = performance.now()
    getEvents(range, { includeHidden: true }).then(
      (result) => {
        if (cancelled) return
        setLoaded({ key, result })
        if (mockMode() === 'stress') {
          const ms = Math.round(performance.now() - startedAt)
          console.info(`[perf] ${result.events.length} events loaded in ${ms} ms`)
        }
      },
      (error: Error) => {
        if (!cancelled) setLoaded({ key, error: error.message })
      },
    )
    return () => {
      cancelled = true
    }
    // The key stands for the range, so the range object itself is not a dependency.
  }, [key, version, attempt])

  const current = loaded.key === key
  return {
    events: current ? (loaded.result?.events ?? []) : [],
    status: current ? loaded.result?.status : undefined,
    error: current ? loaded.error : undefined,
    loading: !current,
    retry: () => {
      setLoaded({ key: '' })
      setAttempt((n) => n + 1)
    },
  }
}
