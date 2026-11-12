// The calendar's data layer. Today it is an in-memory mock; when the backend
// exists, these functions become fetch calls and nothing else changes.
// Changes last until the page reloads.

import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { findConflicts, pairKey } from './conflicts'
import {
  OVERRIDES,
  SEED_HISTORY,
  SOURCE_CALENDARS,
  STORED_EVENTS,
  sourceLabel,
  stressEvents,
  type CalendarEvent,
  type EventOverride,
  type HistoryEntry,
  type HistoryKind,
  type Priority,
  type StoredEvent,
} from './data'
import { demoClock, toLocalIso, type DateRange } from './time'

export type { DateRange } from './time'

/** delayed: a provider is down, so cached events show with a notice. */
export type SyncStatus = 'ok' | 'delayed' | 'no-calendars'

export interface EventsResult {
  events: CalendarEvent[]
  status: SyncStatus
}

export interface QueryOptions {
  /** For the "show hidden" toggle (#87). */
  includeHidden?: boolean
}

type LocalFields = Omit<EventOverride, 'eventId'>

interface Store {
  events: StoredEvent[]
  overrides: Map<string, EventOverride>
  history: HistoryEntry[]
  /** Pairs the user marked "both are fine". */
  acknowledged: Set<string>
}

/**
 * Add ?mock=slow, ?mock=delayed, ?mock=empty, ?mock=error or ?mock=stress
 * to the URL to see the other states of the calendar.
 */
export function mockMode() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('mock')
}

function seed(): Store {
  return {
    events:
      mockMode() === 'stress'
        ? [...STORED_EVENTS, ...stressEvents()]
        : [...STORED_EVENTS],
    overrides: new Map(OVERRIDES.map((o) => [o.eventId, { ...o }])),
    history: [...SEED_HISTORY],
    acknowledged: new Set(),
  }
}

let store = seed()

// A tiny subscription so every view refreshes after a change.
let version = 0
const listeners = new Set<() => void>()

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getVersion = () => version

function commit() {
  version += 1
  listeners.forEach((listener) => listener())
}

/** Puts the mock data back as it started. For tests. */
export function resetStore(events?: StoredEvent[]) {
  store = seed()
  if (events) store.events = [...events]
  commit()
}

// Reads

export function mergeOverride(
  event: StoredEvent,
  override?: EventOverride,
): Omit<CalendarEvent, 'conflictsWith'> {
  const { eventId: _, ...local } = override ?? { eventId: event.id }
  return { ...event, ...local, readOnly: event.source !== 'atlas' }
}

function hiddenReasons() {
  const reasons = new Map<string, string>()
  for (const entry of store.history) {
    if (entry.hid) reasons.set(entry.hid, entry.summary)
  }
  return reasons
}

/** Events that overlap the range, with overrides and conflicts, sorted by start. */
export function queryEvents(
  range: DateRange,
  { includeHidden = false }: QueryOptions = {},
): CalendarEvent[] {
  const from = toLocalIso(range.start)
  const to = toLocalIso(range.end)
  const merged = store.events
    .filter((e) => e.start < to && e.end > from)
    .map((e) => mergeOverride(e, store.overrides.get(e.id)))
  const conflicts = findConflicts(merged, store.acknowledged)
  const reasons = hiddenReasons()
  return merged
    .filter((e) => includeHidden || !e.hidden)
    .map((e) => ({
      ...e,
      conflictsWith: conflicts.get(e.id) ?? [],
      hiddenReason: e.hidden ? reasons.get(e.id) : undefined,
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

export const eventsOnDay = (day: Date, options?: QueryOptions) =>
  queryEvents(
    { start: startOfDay(day), end: addDays(startOfDay(day), 1) },
    options,
  )

/** One event with everything merged, or undefined if it is gone. */
export function getEvent(id: string): CalendarEvent | undefined {
  const stored = store.events.find((e) => e.id === id)
  if (!stored) return undefined
  return queryEvents(
    { start: parseISO(stored.start), end: parseISO(stored.end) },
    { includeHidden: true },
  ).find((e) => e.id === id)
}

export const historyFor = (id: string) =>
  store.history.filter((entry) => entry.eventIds.includes(id))

export const calendarName = (calendarId: string) =>
  SOURCE_CALENDARS.find((c) => c.id === calendarId)?.name

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getEvents(
  range: DateRange,
  options?: QueryOptions,
): Promise<EventsResult> {
  const mode = mockMode()
  await wait(mode === 'slow' ? 3000 : 250)
  if (mode === 'error') throw new Error('The Atlas server did not answer.')
  if (mode === 'empty') return { events: [], status: 'no-calendars' }
  return {
    events: queryEvents(range, options),
    status: mode === 'delayed' ? 'delayed' : 'ok',
  }
}

// Writes

/** Synced events belong to their source app. Atlas refuses to change them. */
export class ReadOnlyError extends Error {}

let nextId = 1

function log(kind: HistoryKind, eventIds: string[], summary: string, hid?: string) {
  const entry: HistoryEntry = {
    id: `h${nextId++}`,
    at: toLocalIso(demoClock()),
    kind,
    eventIds,
    summary,
  }
  if (hid) entry.hid = hid
  store.history = [...store.history, entry]
}

function stored(id: string) {
  const event = store.events.find((e) => e.id === id)
  if (!event) throw new Error(`There is no event ${id}.`)
  return event
}

function requireAtlas(event: StoredEvent) {
  if (event.source !== 'atlas') {
    throw new ReadOnlyError(
      `${event.title} comes from ${sourceLabel(event.source)}. Change it there.`,
    )
  }
}

const partnersOf = (id: string) => getEvent(id)?.conflictsWith ?? []

/** Logs "conflict flagged" when a change makes an event clash with new ones. */
function flagNewConflicts(id: string, before: string[]) {
  const added = partnersOf(id).filter((other) => !before.includes(other))
  if (added.length === 0) return
  const names = added.map((other) => stored(other).title).join(', ')
  log('conflict-flagged', [id, ...added], `${stored(id).title} overlaps ${names}`)
}

export interface EventInput {
  title: string
  start: string
  end: string
  allDay?: boolean
  location?: string
  category?: StoredEvent['category']
  status?: string
}

function validate(input: Partial<EventInput>) {
  if (input.title !== undefined && input.title.trim() === '') {
    throw new Error('Give the event a title.')
  }
  if (input.start && input.end && input.end <= input.start) {
    throw new Error('The event has to end after it starts.')
  }
}

export async function createEvent(
  input: EventInput,
  local: LocalFields = {},
): Promise<CalendarEvent> {
  validate(input)
  const id = `atlas-${Date.now().toString(36)}-${nextId++}`
  store.events = [...store.events, { ...input, id, source: 'atlas', calendarId: 'atlas' }]
  if (Object.keys(local).length > 0) store.overrides.set(id, { eventId: id, ...local })
  log('created', [id], `Created ${input.title}`)
  flagNewConflicts(id, [])
  commit()
  return getEvent(id)!
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<CalendarEvent> {
  const current = stored(id)
  requireAtlas(current)
  const next = { ...current, ...patch }
  validate(next)
  const before = partnersOf(id)
  store.events = store.events.map((e) => (e.id === id ? next : e))

  const changed = (Object.keys(patch) as (keyof EventInput)[]).filter(
    (key) => patch[key] !== current[key],
  )
  const onlyTime = changed.every((key) => key === 'start' || key === 'end')
  if (changed.length > 0 && onlyTime) {
    log('moved', [id], `Moved to ${format(parseISO(next.start), "EEE, MMM d 'at' h:mm a")}`)
  } else if (changed.length > 0) {
    log('edited', [id], `Edited ${changed.join(', ')}`)
  }
  flagNewConflicts(id, before)
  commit()
  return getEvent(id)!
}

/** Drag to move (#99): saves the new time and rechecks conflicts. */
export const moveEvent = (id: string, start: string, end: string) =>
  updateEvent(id, { start, end })

export async function deleteEvent(id: string) {
  const event = stored(id)
  requireAtlas(event)
  store.events = store.events.filter((e) => e.id !== id)
  store.overrides.delete(id)
  log('deleted', [id], `Deleted ${event.title}`)
  commit()
}

const PRIORITY_LABEL: Record<Priority, string> = { low: 'low', medium: 'medium', high: 'high' }

/**
 * Changes one of the user's own settings on an event (#86). Works for
 * synced events too, because these live in Atlas, not in the source.
 * Every call writes exactly one history entry (#84).
 */
export async function setLocal<K extends keyof LocalFields>(
  id: string,
  key: K,
  value: LocalFields[K],
  reason?: string,
): Promise<CalendarEvent> {
  stored(id)
  const current = store.overrides.get(id) ?? { eventId: id }
  if ((current[key] ?? undefined) === (value ?? undefined)) return getEvent(id)!
  store.overrides.set(id, { ...current, [key]: value })

  switch (key) {
    case 'hidden':
      if (value) log('hidden', [id], reason ? `Hidden: ${reason}` : 'Hidden by you', id)
      else log('unhidden', [id], 'Shown again')
      break
    case 'notes':
      log('note', [id], value ? 'Note updated' : 'Note removed')
      break
    case 'priority':
      log('priority', [id], value ? `Priority set to ${PRIORITY_LABEL[value as Priority]}` : 'Priority cleared')
      break
    case 'important':
      log('importance', [id], value ? 'Marked important' : 'No longer important')
      break
    case 'overlapFriendly':
      log('overlap', [id], value ? 'Allowed to overlap other events' : 'No longer allowed to overlap')
      break
  }
  commit()
  return getEvent(id)!
}

/**
 * The user's choice in the conflict dialog (#93): keep one event and hide
 * the other, or keep both. Writes one history entry (#94).
 */
export async function resolveConflict(aId: string, bId: string, keepId: string | null) {
  const a = stored(aId)
  const b = stored(bId)
  if (keepId === null) {
    store.acknowledged.add(pairKey(aId, bId))
    log('conflict-resolved', [aId, bId], `Kept both ${a.title} and ${b.title}`)
  } else {
    const [kept, lost] = keepId === aId ? [a, b] : [b, a]
    const current = store.overrides.get(lost.id) ?? { eventId: lost.id }
    store.overrides.set(lost.id, { ...current, hidden: true })
    log('conflict-resolved', [aId, bId], `Kept ${kept.title} over ${lost.title}`, lost.id)
  }
  commit()
}

/**
 * What a sync does: replaces every synced event with the provider's copy.
 * Atlas events, overrides and history are never touched (#88).
 */
export function resync(incoming: StoredEvent[]) {
  store.events = [
    ...store.events.filter((e) => e.source === 'atlas'),
    ...incoming.filter((e) => e.source !== 'atlas'),
  ]
  commit()
}

/** A copy of the local layer, for tests that check sync leaves it alone. */
export const overridesSnapshot = () =>
  [...store.overrides.values()].map((o) => ({ ...o }))
