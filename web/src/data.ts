// Mock data for the demo. Nothing here comes from a real calendar or model.
// The day is frozen so the screen always matches the design. The calendar
// reads these through calendarApi.ts, which is the only file that changes
// when a real backend exists.

import { addDays, eachDayOfInterval, format, isSameDay } from 'date-fns'
import { DEMO_NOW, minutesOfDay, toLocalIso } from './time'

export const DEMO_DAY = {
  date: format(DEMO_NOW, 'EEEE, MMMM d'),
  nowMinutes: minutesOfDay(DEMO_NOW),
  nowLabel: format(DEMO_NOW, 'h:mm'),
  syncedAt: '6:58 PM',
  syncedAfterRefresh: '7:03 PM',
}

export type Source = 'google' | 'microsoft' | 'canvas' | 'apple' | 'atlas'

export const SOURCES: { id: Source; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'microsoft', label: 'Microsoft' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'apple', label: 'Apple' },
  { id: 'atlas', label: 'Atlas' },
]

export const sourceLabel = (source: Source) =>
  SOURCES.find((s) => s.id === source)?.label ?? source

/** A calendar inside a connected account (PRD table source_calendars). */
export interface SourceCalendar {
  id: string
  source: Source
  name: string
}

export const SOURCE_CALENDARS: SourceCalendar[] = [
  { id: 'google-school', source: 'google', name: 'School' },
  { id: 'google-personal', source: 'google', name: 'Personal' },
  { id: 'google-dept', source: 'google', name: 'CS Department (shared)' },
  { id: 'microsoft-work', source: 'microsoft', name: 'Atlas team' },
  { id: 'canvas-courses', source: 'canvas', name: 'Courses' },
  { id: 'apple-home', source: 'apple', name: 'Home' },
  { id: 'atlas', source: 'atlas', name: 'Atlas' },
]

/** A row of the events table: synced and Atlas events share one shape. */
export interface StoredEvent {
  id: string
  title: string
  source: Source
  calendarId: string
  /** Local ISO time, like "2026-11-04T09:30". */
  start: string
  /** Exclusive end. For all-day events this is midnight after the last day. */
  end: string
  allDay?: boolean
  location?: string
  /** Atlas events only. */
  category?: Category
  status?: string
}

export const CATEGORIES = ['Class', 'Study', 'Work', 'Personal', 'Fitness'] as const
export type Category = (typeof CATEGORIES)[number]

export type Priority = 'low' | 'medium' | 'high'

/** The user's local layer on an event (PRD table event_overrides). Sync never writes it. */
export interface EventOverride {
  eventId: string
  notes?: string
  priority?: Priority
  important?: boolean
  hidden?: boolean
  overlapFriendly?: boolean
}

/** What the views get: an event with its overrides merged in. */
export interface CalendarEvent extends StoredEvent, Omit<EventOverride, 'eventId'> {
  /** Synced events are edited in their source app, never in Atlas. */
  readOnly: boolean
  /** Ids of events this one clashes with. Computed live, never stored. */
  conflictsWith: string[]
  /** Why the event is hidden, from the history entry that hid it. */
  hiddenReason?: string
}

export type HistoryKind =
  | 'created'
  | 'edited'
  | 'moved'
  | 'deleted'
  | 'hidden'
  | 'unhidden'
  | 'note'
  | 'priority'
  | 'importance'
  | 'overlap'
  | 'conflict-flagged'
  | 'conflict-resolved'

/** A row of the event_history table. Feeds the show-hidden view and undo. */
export interface HistoryEntry {
  id: string
  /** Local ISO time. */
  at: string
  kind: HistoryKind
  eventIds: string[]
  summary: string
  /** The event this entry hid, if any. Its summary becomes the hidden reason. */
  hid?: string
}

export const NEEDS_CHECK = 'Needs check'

const RANGE = { start: new Date(2026, 10, 2), end: new Date(2026, 10, 15) }

const at = (day: Date, time: string) =>
  `${format(day, 'yyyy-MM-dd')}T${time}`

const allDay = (day: Date, days = 1) => ({
  start: at(day, '00:00'),
  end: toLocalIso(addDays(day, days)),
  allDay: true,
})

/** The demo day, written out by hand because the Today screen is designed around it. */
const DEMO_DAY_EVENTS: StoredEvent[] = [
  { id: 'dentist', title: 'Dentist', source: 'apple', calendarId: 'apple-home', start: '2026-11-04T08:30', end: '2026-11-04T09:15', location: 'Bright Smile Dental' },
  { id: 'cs455', title: 'CS 455 Lecture', source: 'google', calendarId: 'google-school', start: '2026-11-04T09:30', end: '2026-11-04T10:45', location: 'Engineering Hall 204' },
  { id: 'standup', title: 'Atlas team standup', source: 'microsoft', calendarId: 'microsoft-work', start: '2026-11-04T11:00', end: '2026-11-04T11:45', location: 'Teams' },
  { id: 'seminar', title: 'CS department seminar', source: 'google', calendarId: 'google-dept', start: '2026-11-04T12:00', end: '2026-11-04T13:00', location: 'Exploratory Hall 3301' },
  { id: 'sprint', title: 'Atlas sprint tickets', source: 'atlas', calendarId: 'atlas', start: '2026-11-04T12:00', end: '2026-11-04T13:30', category: 'Work', status: NEEDS_CHECK },
  { id: 'shift', title: 'Part-time shift', source: 'google', calendarId: 'google-personal', start: '2026-11-04T14:30', end: '2026-11-04T18:00', location: 'Campus Bookstore' },
  { id: 'study', title: 'Haskell study', source: 'atlas', calendarId: 'atlas', start: '2026-11-04T16:00', end: '2026-11-04T17:00', category: 'Study' },
  { id: 'gym', title: 'Gym: Push day', source: 'atlas', calendarId: 'atlas', start: '2026-11-04T19:30', end: '2026-11-04T20:30', location: 'Rec Center', category: 'Fitness' },
]

/**
 * A weekly event on the given weekdays (0 is Sunday). The demo day is
 * skipped because DEMO_DAY_EVENTS covers it with the ids the inbox uses.
 */
function weekly(
  key: string,
  weekdays: number[],
  [startTime, endTime]: [string, string],
  event: Omit<StoredEvent, 'id' | 'start' | 'end'>,
): StoredEvent[] {
  return eachDayOfInterval(RANGE)
    .filter((day) => weekdays.includes(day.getDay()) && !isSameDay(day, DEMO_NOW))
    .map((day) => ({
      ...event,
      id: `${key}-${format(day, 'yyyy-MM-dd')}`,
      start: at(day, startTime),
      end: at(day, endTime),
    }))
}

const nov = (day: number) => new Date(2026, 10, day)

/** Two weeks of events, Monday November 2 to Sunday November 15. */
export const STORED_EVENTS: StoredEvent[] = [
  ...DEMO_DAY_EVENTS,
  ...weekly('cs455', [1, 3], ['09:30', '10:45'], { title: 'CS 455 Lecture', source: 'google', calendarId: 'google-school', location: 'Engineering Hall 204' }),
  ...weekly('cs321', [2, 4], ['13:30', '14:45'], { title: 'CS 321 Lecture', source: 'google', calendarId: 'google-school', location: 'Innovation Hall 105' }),
  ...weekly('standup', [1, 3, 5], ['11:00', '11:45'], { title: 'Atlas team standup', source: 'microsoft', calendarId: 'microsoft-work', location: 'Teams' }),
  ...weekly('shift', [3], ['14:30', '18:00'], { title: 'Part-time shift', source: 'google', calendarId: 'google-personal', location: 'Campus Bookstore' }),
  ...weekly('shift-sat', [6], ['10:00', '16:00'], { title: 'Part-time shift', source: 'google', calendarId: 'google-personal', location: 'Campus Bookstore' }),
  ...weekly('gym', [1, 3, 5], ['19:30', '20:30'], { title: 'Gym', source: 'atlas', calendarId: 'atlas', location: 'Rec Center', category: 'Fitness' }),
  { id: 'office-hours-1110', title: 'CS 455 office hours', source: 'google', calendarId: 'google-school', start: '2026-11-10T14:00', end: '2026-11-10T15:00', location: 'Engineering Hall 4400' },
  { id: 'demo-1106', title: 'Sprint demo', source: 'microsoft', calendarId: 'microsoft-work', start: '2026-11-06T15:00', end: '2026-11-06T16:00', location: 'Teams' },
  { id: 'retro-1113', title: 'Sprint retro', source: 'microsoft', calendarId: 'microsoft-work', start: '2026-11-13T15:00', end: '2026-11-13T15:45', location: 'Teams' },
  { id: 'wireframes-1105', title: 'Atlas wireframes', source: 'atlas', calendarId: 'atlas', start: '2026-11-05T16:00', end: '2026-11-05T18:00', category: 'Work' },
  { id: 'dinner-1108', title: 'Family dinner', source: 'apple', calendarId: 'apple-home', start: '2026-11-08T18:00', end: '2026-11-08T20:00' },
  { id: 'haircut-1114', title: 'Haircut', source: 'apple', calendarId: 'apple-home', start: '2026-11-14T11:00', end: '2026-11-14T11:30' },
  { id: 'due-reading', title: 'Due: CS 455 ch. 3 reading', source: 'canvas', calendarId: 'canvas-courses', ...allDay(nov(5)) },
  { id: 'due-ps4', title: 'Due: CS 455 problem set 4', source: 'canvas', calendarId: 'canvas-courses', ...allDay(nov(12)) },
  { id: 'due-quiz6', title: 'Due: Haskell quiz 6', source: 'canvas', calendarId: 'canvas-courses', ...allDay(nov(13)) },
  { id: 'hackathon', title: 'PatriotHacks', source: 'google', calendarId: 'google-personal', location: 'Johnson Center', ...allDay(nov(13), 3) },
]

export const OVERRIDES: EventOverride[] = [
  { eventId: 'cs455', notes: 'Midterm review today. Bring the practice sheet.' },
  { eventId: 'study', priority: 'high', important: true },
  { eventId: 'seminar', hidden: true },
  { eventId: 'office-hours-1110', overlapFriendly: true },
]

export const SEED_HISTORY: HistoryEntry[] = [
  {
    id: 'h-seed-1',
    at: '2026-11-01T10:12',
    kind: 'hidden',
    eventIds: ['seminar'],
    summary: 'Hidden: from the shared department calendar you don’t follow',
    hid: 'seminar',
  },
]

/**
 * About 5,000 events over a year, for the performance check (#76).
 * Seeded, so every run gets the same events. Turn it on with ?mock=stress.
 */
export function stressEvents(count = 5000): StoredEvent[] {
  let seed = 321
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const sources: [Source, string][] = [
    ['google', 'google-personal'],
    ['microsoft', 'microsoft-work'],
    ['apple', 'apple-home'],
    ['atlas', 'atlas'],
  ]
  const first = new Date(2026, 4, 1)
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(first, Math.floor(next() * 365))
    const startMinutes = 7 * 60 + Math.floor(next() * 28) * 30
    const length = 30 + Math.floor(next() * 4) * 30
    const [source, calendarId] = sources[Math.floor(next() * sources.length)]
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, startMinutes)
    const end = new Date(start.getTime() + length * 60_000)
    return {
      id: `stress-${i}`,
      title: `Load test ${i + 1}`,
      source,
      calendarId,
      start: toLocalIso(start),
      end: toLocalIso(end),
    }
  })
}

export type TaskTag =
  | { kind: 'important'; label: string }
  | { kind: 'source'; label: string; source: Source }

export interface Task {
  id: string
  title: string
  meta: string
  tag: TaskTag
}

export const TASKS: Task[] = [
  { id: 'haskell', title: 'Haskell quiz 5 prep', meta: 'Due tonight 11:59 PM  ·  1 h', tag: { kind: 'important', label: 'Important' } },
  { id: 'wireframes', title: 'Atlas wireframes', meta: 'Due Fri  ·  2 h', tag: { kind: 'source', label: 'Atlas', source: 'atlas' } },
  { id: 'reading', title: 'CS 455 ch. 3 reading', meta: 'Due Thu  ·  1.5 h', tag: { kind: 'source', label: 'Canvas', source: 'canvas' } },
]

export const PROPOSED_BLOCKS = [
  'Thu 4:00 - 5:00 PM',
  'Fri 2:00 - 3:00 PM',
  'Sat 10:00 - 11:00 AM',
]

export type InboxId = 'proposal' | 'conflict' | 'tracking' | 'connection'

export const INBOX: InboxId[] = ['proposal', 'conflict', 'tracking', 'connection']

// Canned answers stand in for the AI, which needs a backend.
export const SUGGESTIONS: { question: string; answer: string }[] = [
  {
    question: 'What should I work on now?',
    answer:
      'Start Haskell quiz 5 prep. It is due tonight at 11:59 PM and needs about 1 hour. You have 27 minutes before Gym, so the best full slot is 8:30 - 9:30 PM.',
  },
  {
    question: 'Can I finish this before Friday?',
    answer:
      'Yes. Atlas wireframes needs 2 hours and CS 455 ch. 3 reading needs 1.5 hours. Your open time on Thursday covers both.',
  },
  {
    question: 'Find me two free hours',
    answer:
      'You are free tonight from 8:30 to 10:30 PM, right after Gym. Nothing else is on your calendar in that window.',
  },
]

export const FALLBACK_ANSWER =
  'This demo answers the three suggested questions. Try one of them below.'
