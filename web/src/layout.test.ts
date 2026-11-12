import { describe, expect, it } from 'vitest'
import { eventsOnDate, layoutAllDay, layoutDay } from './layout'

const day = new Date(2026, 10, 4)
const ev = (id: string, start: string, end: string) => ({
  id,
  start: `2026-11-04T${start}`,
  end: `2026-11-04T${end}`,
})

const columns = (result: ReturnType<typeof layoutDay<ReturnType<typeof ev>>>) =>
  Object.fromEntries(result.placed.map((p) => [p.event.id, [p.col, p.cols]]))

describe('layoutDay', () => {
  it('gives a lone event the full width, positioned in minutes', () => {
    const { placed } = layoutDay([ev('a', '09:30', '10:45')], day)
    expect(placed).toMatchObject([{ top: 570, height: 75, col: 0, cols: 1 }])
  })

  it('splits overlapping events into columns', () => {
    const result = layoutDay([ev('shift', '14:30', '18:00'), ev('study', '16:00', '17:00')], day)
    expect(columns(result)).toEqual({ shift: [0, 2], study: [1, 2] })
  })

  it('keeps touching events full width', () => {
    const result = layoutDay([ev('a', '09:00', '10:00'), ev('b', '10:00', '11:00')], day)
    expect(columns(result)).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('reuses a column when a chain of events never has three at once', () => {
    const result = layoutDay(
      [ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30'), ev('c', '10:00', '11:00')],
      day,
      { collapseAt: 3 },
    )
    expect(columns(result)).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] })
    expect(result.collapsed).toEqual([])
  })

  // #92: three or more overlapping events collapse into a badge.
  it('folds three overlapping events into one event and a +2 badge', () => {
    const events = [ev('a', '09:00', '12:00'), ev('b', '10:00', '11:00'), ev('c', '10:30', '11:30')]
    const result = layoutDay(events, day, { collapseAt: 3 })
    expect(columns(result)).toEqual({ a: [0, 2] })
    expect(result.collapsed).toHaveLength(1)
    expect(result.collapsed[0]).toMatchObject({ top: 600, hiddenCount: 2 })
    expect(result.collapsed[0].events.map((e) => e.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('gives very short events enough room not to cover the next one', () => {
    const result = layoutDay([ev('a', '09:00', '09:05'), ev('b', '09:10', '09:40')], day)
    expect(columns(result)).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('clips an event that runs past midnight to the day', () => {
    const late = { id: 'late', start: '2026-11-04T23:00', end: '2026-11-05T01:00' }
    expect(layoutDay([late], day).placed[0]).toMatchObject({ top: 1380, height: 60 })
    expect(layoutDay([late], new Date(2026, 10, 5)).placed[0]).toMatchObject({ top: 0, height: 60 })
  })

  it('leaves all-day events to the all-day row', () => {
    const due = { id: 'due', start: '2026-11-04T00:00', end: '2026-11-05T00:00', allDay: true }
    expect(layoutDay([due], day).placed).toEqual([])
  })
})

describe('layoutAllDay', () => {
  const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 9 + i))
  const allDay = (id: string, from: number, to: number) => ({
    id,
    start: `2026-11-${String(from).padStart(2, '0')}T00:00`,
    end: `2026-11-${String(to).padStart(2, '0')}T00:00`,
    allDay: true,
  })

  it('spans a multi-day event across its days and stacks what overlaps it', () => {
    const { bars, rows } = layoutAllDay(
      [allDay('hackathon', 13, 16), allDay('quiz', 13, 14), allDay('ps4', 12, 13)],
      week,
    )
    const byId = Object.fromEntries(bars.map((b) => [b.event.id, b]))
    expect(byId.ps4).toMatchObject({ start: 3, span: 1, row: 0 })
    expect(byId.hackathon).toMatchObject({ start: 4, span: 3, row: 0 })
    expect(byId.quiz).toMatchObject({ start: 4, span: 1, row: 1 })
    expect(rows).toBe(2)
  })

  it('cuts a bar at the edge of the week', () => {
    const { bars } = layoutAllDay([allDay('trip', 7, 11)], week)
    expect(bars[0]).toMatchObject({ start: 0, span: 2 })
  })
})

describe('eventsOnDate', () => {
  it('puts all-day events first, then sorts by start', () => {
    const events = [
      ev('late', '15:00', '16:00'),
      { id: 'due', start: '2026-11-04T00:00', end: '2026-11-05T00:00', allDay: true },
      ev('early', '08:00', '09:00'),
      { id: 'other-day', start: '2026-11-05T08:00', end: '2026-11-05T09:00' },
    ]
    expect(eventsOnDate(events, day).map((e) => e.id)).toEqual(['due', 'early', 'late'])
  })
})
