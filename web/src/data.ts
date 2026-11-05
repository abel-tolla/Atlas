// Mock data for the demo. Nothing here comes from a real calendar or model.
// The day is frozen so the screen always matches the design.

export const DEMO_DAY = {
  date: 'Wednesday, November 4',
  nowMinutes: 19 * 60 + 3,
  nowLabel: '7:03',
  syncedAt: '6:58 PM',
  syncedAfterRefresh: '7:03 PM',
}

export type Source = 'google' | 'outlook' | 'canvas' | 'apple' | 'atlas'

export const SOURCES: { id: Source; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'apple', label: 'Apple' },
  { id: 'atlas', label: 'Atlas' },
]

export const sourceLabel = (source: Source) =>
  SOURCES.find((s) => s.id === source)?.label ?? source

export interface CalendarEvent {
  id: string
  title: string
  source: Source
  /** Minutes after midnight. */
  start: number
  minutes: number
  time: string
  status?: string
  conflict?: boolean
}

export const NEEDS_CHECK = 'Needs check'

export const EVENTS: CalendarEvent[] = [
  { id: 'dentist', title: 'Dentist', source: 'apple', start: 8 * 60 + 30, minutes: 45, time: '8:30 AM' },
  { id: 'cs455', title: 'CS 455 Lecture', source: 'google', start: 9 * 60 + 30, minutes: 75, time: '9:30 - 10:45 AM' },
  { id: 'standup', title: 'Atlas team standup', source: 'outlook', start: 11 * 60, minutes: 45, time: '11:00 AM' },
  { id: 'sprint', title: 'Atlas sprint tickets', source: 'atlas', start: 12 * 60, minutes: 90, time: '12:00 - 1:30 PM', status: NEEDS_CHECK },
  { id: 'shift', title: 'Part-time shift', source: 'google', start: 14 * 60 + 30, minutes: 210, time: '2:30 - 6:00 PM' },
  { id: 'study', title: 'Haskell study', source: 'atlas', start: 16 * 60, minutes: 60, time: '4:00 PM', conflict: true },
  { id: 'gym', title: 'Gym: Push day', source: 'atlas', start: 19 * 60 + 30, minutes: 60, time: '7:30 PM' },
]

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
