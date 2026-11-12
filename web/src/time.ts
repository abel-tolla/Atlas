import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

/** Weeks start on Monday across the app. */
export const WEEK_STARTS_ON = 1

/** The demo clock is frozen so the screens always match the design. */
export const DEMO_NOW = new Date(2026, 10, 4, 19, 3)

const loadedAt = Date.now()

/** The demo clock, ticking forward from DEMO_NOW. Used to timestamp history. */
export const demoClock = () => new Date(DEMO_NOW.getTime() + (Date.now() - loadedAt))

/**
 * Event times are local ISO strings without an offset, like
 * "2026-11-04T09:30". They all share this format, so comparing two of them
 * as strings gives the same answer as comparing the times.
 */
export const toLocalIso = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm")

export const minutesOfDay = (date: Date) =>
  date.getHours() * 60 + date.getMinutes()

export const durationMinutes = (start: string, end: string) =>
  differenceInMinutes(parseISO(end), parseISO(start))

export const formatTime = (date: Date) => format(date, 'h:mm a')

/** "9:30 - 10:45 AM" when both ends share AM or PM, else "11:30 AM - 1:00 PM". */
export function formatTimeRange(start: Date, end: Date) {
  const sameHalf = format(start, 'a') === format(end, 'a')
  return sameHalf
    ? `${format(start, 'h:mm')} - ${format(end, 'h:mm a')}`
    : `${formatTime(start)} - ${formatTime(end)}`
}

export interface DateRange {
  start: Date
  /** Exclusive. */
  end: Date
}

export type CalendarMode = 'day' | 'week' | 'month'

export const weekStart = (date: Date) =>
  startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })

/** The dates a view shows. Month always shows six full weeks. */
export function rangeFor(mode: CalendarMode, anchor: Date): DateRange {
  if (mode === 'day') {
    const start = startOfDay(anchor)
    return { start, end: addDays(start, 1) }
  }
  if (mode === 'week') {
    const start = weekStart(anchor)
    return { start, end: addDays(start, 7) }
  }
  const start = weekStart(startOfMonth(anchor))
  return { start, end: addDays(start, 42) }
}

export function shiftAnchor(mode: CalendarMode, anchor: Date, step: 1 | -1) {
  if (mode === 'day') return addDays(anchor, step)
  if (mode === 'week') return addWeeks(anchor, step)
  return addMonths(anchor, step)
}

/** "Wednesday, November 4, 2026", "Nov 2 – 8, 2026" or "November 2026". */
export function rangeLabel(mode: CalendarMode, anchor: Date) {
  if (mode === 'day') return format(anchor, 'EEEE, MMMM d, yyyy')
  if (mode === 'month') return format(anchor, 'MMMM yyyy')
  const start = weekStart(anchor)
  const end = addDays(start, 6)
  if (isSameMonth(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
  }
  if (isSameYear(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

export const daysIn = (range: DateRange) => {
  const days: Date[] = []
  for (let day = range.start; day < range.end; day = addDays(day, 1)) {
    days.push(day)
  }
  return days
}

/** "Wed, Nov 4 · 9:30 - 10:45 AM", or "Fri, Nov 13 – Sun, Nov 15 · All day". */
export function formatEventWhen(event: {
  start: string
  end: string
  allDay?: boolean
}) {
  const start = parseISO(event.start)
  const end = parseISO(event.end)
  if (event.allDay) {
    const last = addDays(end, -1)
    return toLocalIso(start).slice(0, 10) === toLocalIso(last).slice(0, 10)
      ? `${format(start, 'EEE, MMM d')}  ·  All day`
      : `${format(start, 'EEE, MMM d')} – ${format(last, 'EEE, MMM d')}  ·  All day`
  }
  const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
  return sameDay
    ? `${format(start, 'EEE, MMM d')}  ·  ${formatTimeRange(start, end)}`
    : `${format(start, 'EEE, MMM d, h:mm a')} – ${format(end, 'EEE, MMM d, h:mm a')}`
}
