// Where events go on the calendar grids. Plain functions, shared by the
// Today timeline and the calendar views, and tested on their own.

import { addDays, addMinutes, differenceInCalendarDays, parseISO } from 'date-fns'
import { toLocalIso } from './time'

interface Timed {
  id: string
  start: string
  end: string
  allDay?: boolean
}

export interface Placed<E> {
  event: E
  /** Minutes after the start of the day. */
  top: number
  /** Minutes. */
  height: number
  /** Column inside its overlap group, and how many columns the group has. */
  col: number
  cols: number
}

/** Three or more overlapping events fold into one "+N more" badge (#92). */
export interface Collapsed<E> {
  top: number
  height: number
  /** Every event in the group, for the expanded list. */
  events: E[]
  /** How many of them the badge stands for. */
  hiddenCount: number
}

export interface DayLayout<E> {
  placed: Placed<E>[]
  collapsed: Collapsed<E>[]
}

const DAY_MINUTES = 24 * 60

/**
 * Lays out the timed events of one day. Events that overlap share the width
 * in columns. Very short events are treated as at least `minMinutes` long so
 * their blocks never cover each other.
 *
 * When a group needs `collapseAt` columns or more, only the first column is
 * drawn (at half width) and the rest fold into a badge beside it.
 */
export function layoutDay<E extends Timed>(
  events: E[],
  day: Date,
  { collapseAt = Infinity, minMinutes = 20 } = {},
): DayLayout<E> {
  const dayStart = toLocalIso(day)
  const dayEnd = toLocalIso(addDays(day, 1))

  const items = events
    .filter((e) => !e.allDay && e.start < dayEnd && e.end > dayStart)
    .map((event) => {
      const from = event.start < dayStart ? 0 : minutesInto(day, event.start)
      const to = event.end > dayEnd ? DAY_MINUTES : minutesInto(day, event.end)
      return { event, top: from, bottom: Math.max(to, from + minMinutes) }
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom)

  const result: DayLayout<E> = { placed: [], collapsed: [] }
  let group: { item: (typeof items)[number]; col: number }[] = []
  let columnEnds: number[] = []
  let groupEnd = -1

  const closeGroup = () => {
    if (group.length === 0) return
    const cols = columnEnds.length
    if (cols >= collapseAt) {
      const folded = group.filter((g) => g.col > 0)
      const top = Math.min(...folded.map((g) => g.item.top))
      result.placed.push(
        ...group
          .filter((g) => g.col === 0)
          .map((g) => placed(g.item, 0, 2)),
      )
      result.collapsed.push({
        top,
        height: Math.max(groupEnd - top, minMinutes),
        events: group.map((g) => g.item.event),
        hiddenCount: folded.length,
      })
    } else {
      result.placed.push(...group.map((g) => placed(g.item, g.col, cols)))
    }
    group = []
    columnEnds = []
  }

  for (const item of items) {
    if (item.top >= groupEnd) closeGroup()
    let col = columnEnds.findIndex((end) => end <= item.top)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(item.bottom)
    } else {
      columnEnds[col] = item.bottom
    }
    group.push({ item, col })
    groupEnd = Math.max(groupEnd, item.bottom)
  }
  closeGroup()
  return result
}

function placed<E>(
  item: { event: E; top: number; bottom: number },
  col: number,
  cols: number,
): Placed<E> {
  return { event: item.event, top: item.top, height: item.bottom - item.top, col, cols }
}

function minutesInto(day: Date, iso: string) {
  return Math.round((parseISO(iso).getTime() - day.getTime()) / 60_000)
}

export interface AllDayBar<E> {
  event: E
  /** First column, and how many columns it covers. */
  start: number
  span: number
  row: number
}

/**
 * Lays out all-day events as bars across a row of days, stacking them so
 * multi-day events never overlap.
 */
export function layoutAllDay<E extends Timed>(events: E[], days: Date[]) {
  const first = days[0]
  const last = days.length - 1
  const bars = events
    .filter((e) => e.allDay)
    .map((event) => {
      const from = differenceInCalendarDays(parseISO(event.start), first)
      const to = differenceInCalendarDays(addMinutes(parseISO(event.end), -1), first)
      return { event, from: Math.max(from, 0), to: Math.min(to, last) }
    })
    .filter((bar) => bar.to >= 0 && bar.from <= last)
    .sort((a, b) => a.from - b.from || b.to - b.from - (a.to - a.from))

  const rowEnds: number[] = []
  const result: AllDayBar<E>[] = bars.map(({ event, from, to }) => {
    let row = rowEnds.findIndex((end) => end < from)
    if (row === -1) {
      row = rowEnds.length
      rowEnds.push(to)
    } else {
      rowEnds[row] = to
    }
    return { event, start: from, span: to - from + 1, row }
  })
  return { bars: result, rows: rowEnds.length }
}

/** Events on a day: all-day first, then by start time. */
export function eventsOnDate<E extends Timed>(events: E[], day: Date) {
  const dayStart = toLocalIso(day)
  const dayEnd = toLocalIso(addDays(day, 1))
  return events
    .filter((e) => e.start < dayEnd && e.end > dayStart)
    .sort(
      (a, b) =>
        Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) ||
        a.start.localeCompare(b.start),
    )
}
