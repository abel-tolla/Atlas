import { describe, expect, it } from 'vitest'
import { formatEventWhen, formatTimeRange, rangeFor, rangeLabel, shiftAnchor } from './time'

const wed = new Date(2026, 10, 4)

describe('rangeFor', () => {
  it('covers one day in Day view', () => {
    expect(rangeFor('day', new Date(2026, 10, 4, 19, 3))).toEqual({
      start: new Date(2026, 10, 4),
      end: new Date(2026, 10, 5),
    })
  })

  it('covers Monday to Sunday in Week view', () => {
    expect(rangeFor('week', wed)).toEqual({ start: new Date(2026, 10, 2), end: new Date(2026, 10, 9) })
  })

  it('covers six full weeks in Month view', () => {
    const { start, end } = rangeFor('month', wed)
    expect(start).toEqual(new Date(2026, 9, 26))
    expect(end).toEqual(new Date(2026, 11, 7))
  })
})

// #69: the date position is kept when switching views, because every view
// is built from the same anchor date.
describe('switching views', () => {
  it('keeps the same date in view', () => {
    for (const mode of ['day', 'week', 'month'] as const) {
      const { start, end } = rangeFor(mode, wed)
      expect(start <= wed && wed < end).toBe(true)
    }
  })

  it('steps by a day, a week or a month', () => {
    expect(shiftAnchor('day', wed, 1)).toEqual(new Date(2026, 10, 5))
    expect(shiftAnchor('week', wed, -1)).toEqual(new Date(2026, 9, 28))
    expect(shiftAnchor('month', wed, 1)).toEqual(new Date(2026, 11, 4))
  })
})

describe('rangeLabel', () => {
  it('names each view', () => {
    expect(rangeLabel('day', wed)).toBe('Wednesday, November 4, 2026')
    expect(rangeLabel('week', wed)).toBe('Nov 2 – 8, 2026')
    expect(rangeLabel('month', wed)).toBe('November 2026')
  })

  it('handles weeks that cross a month or a year', () => {
    expect(rangeLabel('week', new Date(2026, 9, 28))).toBe('Oct 26 – Nov 1, 2026')
    expect(rangeLabel('week', new Date(2026, 11, 30))).toBe('Dec 28, 2026 – Jan 3, 2027')
  })
})

describe('formatting', () => {
  it('shares AM or PM when both ends match', () => {
    expect(formatTimeRange(new Date(2026, 10, 4, 9, 30), new Date(2026, 10, 4, 10, 45))).toBe('9:30 - 10:45 AM')
  })

  it('writes both halves when they differ', () => {
    expect(formatTimeRange(new Date(2026, 10, 4, 11, 30), new Date(2026, 10, 4, 13, 0))).toBe('11:30 AM - 1:00 PM')
  })

  it('describes timed, all-day and multi-day events', () => {
    expect(formatEventWhen({ start: '2026-11-04T09:30', end: '2026-11-04T10:45' })).toBe(
      'Wed, Nov 4  ·  9:30 - 10:45 AM',
    )
    expect(formatEventWhen({ start: '2026-11-05T00:00', end: '2026-11-06T00:00', allDay: true })).toBe(
      'Thu, Nov 5  ·  All day',
    )
    expect(formatEventWhen({ start: '2026-11-13T00:00', end: '2026-11-16T00:00', allDay: true })).toBe(
      'Fri, Nov 13 – Sun, Nov 15  ·  All day',
    )
  })
})
