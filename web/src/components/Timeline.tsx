import { parseISO, startOfDay } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import {
  DEMO_DAY,
  NEEDS_CHECK,
  sourceLabel,
  type CalendarEvent,
} from '../data'
import { layoutDay } from '../layout'
import {
  DEMO_NOW,
  durationMinutes,
  formatTime,
  formatTimeRange,
  minutesOfDay,
} from '../time'

const FIRST_HOUR = 8
const LAST_HOUR = 21
const PX_PER_MINUTE = 0.5
const EVENT_INSET = 1
const TWO_LINE_MIN_MINUTES = 75

const hourLabel = (hour: number) =>
  `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`

const toPx = (minutes: number) => (minutes - FIRST_HOUR * 60) * PX_PER_MINUTE

const startMinutes = (event: CalendarEvent) =>
  minutesOfDay(parseISO(event.start))

const lengthMinutes = (event: CalendarEvent) =>
  durationMinutes(event.start, event.end)

/** The lane is null when the event has the full width of the timeline. */
function lanesOf(events: CalendarEvent[]) {
  const { placed } = layoutDay(events, startOfDay(DEMO_NOW))
  return new Map(
    placed.map(({ event, col, cols }) => [
      event.id,
      cols === 1 ? null : col === 0 ? ('left' as const) : ('right' as const),
    ]),
  )
}

/**
 * The timeline is narrow, so it flags only the event that lands on top of
 * an earlier one. The calendar flags both.
 */
const flagged = (event: CalendarEvent, events: CalendarEvent[]) =>
  event.conflictsWith.some((id) =>
    events.some((other) => other.id === id && other.start <= event.start),
  )

interface TimelineProps {
  events: CalendarEvent[]
  onOpenCalendar: () => void
}

export function Timeline({ events: allEvents, onOpenCalendar }: TimelineProps) {
  // All-day events (like Canvas due dates) have no place on an hour grid.
  const events = allEvents.filter((event) => !event.allDay)
  const lanes = lanesOf(events)
  const hours = Array.from(
    { length: LAST_HOUR - FIRST_HOUR + 1 },
    (_, index) => FIRST_HOUR + index,
  )

  return (
    <section className="timeline card" aria-labelledby="timeline-heading">
      <div className="card-head">
        <h2 id="timeline-heading">Today's timeline</h2>
        <button type="button" className="link timeline-open" onClick={onOpenCalendar}>
          Open calendar
          <ChevronRight size={16} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
        </button>
      </div>

      <div
        className="timeline-grid"
        style={{ height: (LAST_HOUR - FIRST_HOUR) * 60 * PX_PER_MINUTE }}
      >
        {hours.map((hour) => (
          <div key={hour} className="timeline-hour" style={{ top: toPx(hour * 60) }}>
            <span>{hourLabel(hour)}</span>
          </div>
        ))}

        <ol className="timeline-events">
          {events.map((event) => (
            <EventBlock
              key={event.id}
              event={event}
              lane={lanes.get(event.id) ?? null}
              conflict={flagged(event, events)}
            />
          ))}
        </ol>

        <div
          className="timeline-now"
          style={{ top: toPx(DEMO_DAY.nowMinutes) }}
          aria-label={`Now, ${DEMO_DAY.nowLabel} PM`}
        >
          <span>{DEMO_DAY.nowLabel}</span>
        </div>
      </div>
    </section>
  )
}

interface EventBlockProps {
  event: CalendarEvent
  lane: 'left' | 'right' | null
  conflict: boolean
}

function EventBlock({ event, lane, conflict }: EventBlockProps) {
  const minutes = lengthMinutes(event)
  const twoLine = minutes >= TWO_LINE_MIN_MINUTES
  const source = sourceLabel(event.source)
  const start = parseISO(event.start)
  const time = twoLine
    ? formatTimeRange(start, parseISO(event.end))
    : formatTime(start)
  const className = [
    'event',
    twoLine ? 'event--tall' : '',
    event.status === NEEDS_CHECK ? 'event--unchecked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={className}
      data-source={event.source}
      data-lane={lane ?? undefined}
      style={{
        top: toPx(startMinutes(event)) + EVENT_INSET,
        height: minutes * PX_PER_MINUTE - 2 * EVENT_INSET,
      }}
    >
      {twoLine ? (
        <>
          <span className="event-title">{event.title}</span>
          <span className="event-meta">
            {time}  ·  {event.status ?? source}
          </span>
        </>
      ) : (
        <span className="event-line">
          {event.title}  ·  {time}
          {lane ? '' : `  ·  ${source}`}
        </span>
      )}
      {conflict && (
        <span className="event-flag" role="img" aria-label="Conflict">
          !
        </span>
      )}
    </li>
  )
}
