import { beforeEach, describe, expect, it } from 'vitest'
import {
  ReadOnlyError,
  createEvent,
  deleteEvent,
  eventsOnDay,
  getEvent,
  getEvents,
  historyFor,
  mergeOverride,
  moveEvent,
  overridesSnapshot,
  queryEvents,
  resetStore,
  resolveConflict,
  resync,
  setLocal,
  updateEvent,
} from './calendarApi'
import { STORED_EVENTS, stressEvents, type StoredEvent } from './data'
import { layoutDay } from './layout'
import { DEMO_NOW, daysIn, rangeFor } from './time'

const week = { start: new Date(2026, 10, 2), end: new Date(2026, 10, 9) }
const ids = (events: { id: string }[]) => events.map((e) => e.id)

beforeEach(() => resetStore())

describe('queryEvents', () => {
  it('keeps the demo day exactly as the Today design shows it', () => {
    expect(ids(eventsOnDay(DEMO_NOW))).toEqual(['dentist', 'cs455', 'standup', 'sprint', 'shift', 'study', 'gym'])
  })

  it('returns only events that overlap the range', () => {
    const events = queryEvents(week)
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.start < '2026-11-09T00:00').toBe(true)
      expect(e.end > '2026-11-02T00:00').toBe(true)
    }
    expect(ids(events)).toContain('dinner-1108')
    expect(ids(events)).not.toContain('office-hours-1110')
  })

  it('includes a multi-day event on every day it covers', () => {
    for (const day of [13, 14, 15]) {
      expect(ids(eventsOnDay(new Date(2026, 10, day)))).toContain('hackathon')
    }
    expect(ids(eventsOnDay(new Date(2026, 10, 16)))).not.toContain('hackathon')
  })

  it('does not count an event that ends exactly when the range starts', () => {
    expect(
      queryEvents({ start: new Date(2026, 10, 4, 9, 15), end: new Date(2026, 10, 4, 9, 30) }),
    ).toEqual([])
  })

  it('returns events sorted by start time', () => {
    const starts = queryEvents(week).map((e) => e.start)
    expect(starts).toEqual([...starts].sort())
  })

  // #83: an event with a note comes back with the note attached.
  it('merges the user’s overrides into each event', () => {
    expect(getEvent('cs455')?.notes).toBe('Midterm review today. Bring the practice sheet.')
    expect(getEvent('study')).toMatchObject({ priority: 'high', important: true })
  })
})

describe('mergeOverride', () => {
  const synced: StoredEvent = {
    id: 'x', title: 'Lecture', source: 'google', calendarId: 'google-school',
    start: '2026-11-04T09:00', end: '2026-11-04T10:00',
  }

  it('attaches the note and keeps the synced fields', () => {
    const merged = mergeOverride(synced, { eventId: 'x', notes: 'Bring laptop' })
    expect(merged).toMatchObject({ title: 'Lecture', notes: 'Bring laptop', readOnly: true })
    expect(merged).not.toHaveProperty('eventId')
  })

  it('marks only Atlas events as editable', () => {
    expect(mergeOverride(synced).readOnly).toBe(true)
    expect(mergeOverride({ ...synced, source: 'atlas' }).readOnly).toBe(false)
  })
})

describe('getEvents', () => {
  it('resolves with every event in the range and an ok status', async () => {
    const result = await getEvents(week)
    expect(result.status).toBe('ok')
    expect(result.events).toEqual(queryEvents(week))
  })
})

describe('conflicts in the mock data', () => {
  it('flags Haskell study and the shift on the demo day', () => {
    expect(getEvent('study')?.conflictsWith).toEqual(['shift'])
    expect(getEvent('shift')?.conflictsWith).toEqual(['study'])
  })

  it('ignores the hidden seminar and the overlap-friendly office hours', () => {
    expect(getEvent('sprint')?.conflictsWith).toEqual([])
    expect(getEvent('office-hours-1110')?.conflictsWith).toEqual([])
  })
})

// #93 and #94
describe('resolveConflict', () => {
  it('hides the event the user did not keep, with the reason, in one entry', async () => {
    const before = historyFor('shift').length
    await resolveConflict('study', 'shift', 'study')
    const shift = getEvent('shift')!
    expect(shift.hidden).toBe(true)
    expect(shift.hiddenReason).toBe('Kept Haskell study over Part-time shift')
    expect(getEvent('study')?.conflictsWith).toEqual([])
    expect(historyFor('shift')).toHaveLength(before + 1)
    expect(historyFor('shift').at(-1)?.kind).toBe('conflict-resolved')
  })

  it('keeps both and clears the marker when both are fine', async () => {
    await resolveConflict('study', 'shift', null)
    for (const id of ['study', 'shift']) {
      expect(getEvent(id)?.hidden).toBeFalsy()
      expect(getEvent(id)?.conflictsWith).toEqual([])
    }
    expect(historyFor('study').at(-1)?.summary).toBe('Kept both Haskell study and Part-time shift')
  })
})

// #84 to #87
describe('the user’s own settings', () => {
  it('writes exactly one history entry for every action', async () => {
    const actions: [Parameters<typeof setLocal>[1], unknown][] = [
      ['notes', 'Ask about the curve'],
      ['priority', 'high'],
      ['important', true],
      ['overlapFriendly', true],
      ['hidden', true],
      ['hidden', false],
    ]
    for (const [key, value] of actions) {
      const before = historyFor('standup').length
      await setLocal('standup', key, value as never)
      expect(historyFor('standup')).toHaveLength(before + 1)
    }
  })

  it('writes nothing when a setting does not change', async () => {
    await setLocal('standup', 'priority', 'low')
    const before = historyFor('standup').length
    await setLocal('standup', 'priority', 'low')
    expect(historyFor('standup')).toHaveLength(before)
  })

  it('removes a hidden event from the views and from conflicts', async () => {
    await setLocal('shift', 'hidden', true, 'I swapped this shift')
    expect(ids(eventsOnDay(DEMO_NOW))).not.toContain('shift')
    expect(getEvent('study')?.conflictsWith).toEqual([])
  })

  it('lists hidden events with the same reason as the history entry', async () => {
    await setLocal('shift', 'hidden', true, 'I swapped this shift')
    const shift = eventsOnDay(DEMO_NOW, { includeHidden: true }).find((e) => e.id === 'shift')!
    expect(shift.hiddenReason).toBe('Hidden: I swapped this shift')
    expect(historyFor('shift').at(-1)?.summary).toBe(shift.hiddenReason)
  })

  it('shows the seeded hidden seminar with its reason', () => {
    const seminar = eventsOnDay(DEMO_NOW, { includeHidden: true }).find((e) => e.id === 'seminar')
    expect(seminar?.hiddenReason).toMatch(/shared department calendar/)
  })

  it('lets an event overlap without a conflict', async () => {
    await setLocal('shift', 'overlapFriendly', true)
    expect(getEvent('study')?.conflictsWith).toEqual([])
  })
})

// #88: the promise to users. Syncing never undoes their changes.
describe('re-sync', () => {
  it('never changes a note, flag or priority', async () => {
    await setLocal('cs455', 'priority', 'medium')
    await setLocal('shift', 'hidden', true)
    await setLocal('standup', 'important', true)
    await setLocal('dentist', 'overlapFriendly', true)
    const before = overridesSnapshot()

    // The provider sends back every synced event, renamed and moved.
    const incoming = STORED_EVENTS.filter((e) => e.source !== 'atlas').map((e) => ({
      ...e,
      title: `${e.title} (updated)`,
      location: 'Somewhere new',
    }))
    resync(incoming)

    expect(overridesSnapshot()).toEqual(before)
    expect(getEvent('cs455')).toMatchObject({
      title: 'CS 455 Lecture (updated)',
      notes: 'Midterm review today. Bring the practice sheet.',
      priority: 'medium',
    })
    expect(getEvent('shift')?.hidden).toBe(true)
    expect(getEvent('standup')?.important).toBe(true)
    expect(getEvent('dentist')?.overlapFriendly).toBe(true)
  })

  it('leaves Atlas events alone', () => {
    resync([])
    expect(getEvent('study')?.title).toBe('Haskell study')
    expect(getEvent('cs455')).toBeUndefined()
  })
})

// #96 to #99
describe('Atlas events', () => {
  it('creates an event that shows on the calendar and flags new conflicts', async () => {
    const created = await createEvent(
      { title: 'Office prep', start: '2026-11-04T19:00', end: '2026-11-04T20:00', category: 'Study' },
      { important: true },
    )
    expect(ids(eventsOnDay(DEMO_NOW))).toContain(created.id)
    expect(created).toMatchObject({ source: 'atlas', readOnly: false, important: true })
    expect(created.conflictsWith).toEqual(['gym'])
    expect(historyFor(created.id).map((h) => h.kind)).toEqual(['created', 'conflict-flagged'])
  })

  it('refuses an event that ends before it starts', async () => {
    await expect(
      createEvent({ title: 'Backwards', start: '2026-11-04T10:00', end: '2026-11-04T09:00' }),
    ).rejects.toThrow('end after it starts')
  })

  it('edits and deletes Atlas events', async () => {
    await updateEvent('gym', { title: 'Gym: Pull day', location: 'Field house' })
    expect(getEvent('gym')).toMatchObject({ title: 'Gym: Pull day', location: 'Field house' })
    expect(historyFor('gym').at(-1)?.kind).toBe('edited')
    await deleteEvent('gym')
    expect(getEvent('gym')).toBeUndefined()
  })

  it('refuses to change or delete synced events', async () => {
    await expect(updateEvent('cs455', { title: 'Nope' })).rejects.toBeInstanceOf(ReadOnlyError)
    await expect(moveEvent('shift', '2026-11-04T08:00', '2026-11-04T09:00')).rejects.toBeInstanceOf(ReadOnlyError)
    await expect(deleteEvent('dentist')).rejects.toBeInstanceOf(ReadOnlyError)
    expect(getEvent('cs455')?.title).toBe('CS 455 Lecture')
  })

  it('saves a moved event and rechecks conflicts', async () => {
    const moved = await moveEvent('gym', '2026-11-04T15:00', '2026-11-04T16:00')
    expect(moved).toMatchObject({ start: '2026-11-04T15:00', end: '2026-11-04T16:00' })
    expect(moved.conflictsWith).toEqual(['shift'])
    expect(historyFor('gym').map((h) => h.kind)).toEqual(['moved', 'conflict-flagged'])
    expect(historyFor('gym')[0].summary).toBe('Moved to Wed, Nov 4 at 3:00 PM')
  })

  it('moves an event to another day', async () => {
    await moveEvent('study', '2026-11-05T16:00', '2026-11-05T17:00')
    expect(ids(eventsOnDay(DEMO_NOW))).not.toContain('study')
    expect(ids(eventsOnDay(new Date(2026, 10, 5)))).toContain('study')
  })
})

// #76: with about 5,000 events, a week still loads in under a second.
describe('performance', () => {
  it('queries and lays out a busy week fast', () => {
    resetStore([...STORED_EVENTS, ...stressEvents(5000)])
    const started = performance.now()
    const range = rangeFor('week', new Date(2026, 10, 18))
    const events = queryEvents(range, { includeHidden: true })
    for (const day of daysIn(range)) layoutDay(events, day, { collapseAt: 3 })
    const ms = performance.now() - started
    expect(events.length).toBeGreaterThan(50)
    expect(ms).toBeLessThan(1000)
  })
})
