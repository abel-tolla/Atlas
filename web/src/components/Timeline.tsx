import { ChevronRight } from 'lucide-react'
import {
  DEMO_DAY,
  NEEDS_CHECK,
  sourceLabel,
  type CalendarEvent,
} from '../data'

const FIRST_HOUR = 8
const LAST_HOUR = 21
const PX_PER_MINUTE = 0.5
const EVENT_INSET = 1
const TWO_LINE_MIN_MINUTES = 75

const hourLabel = (hour: number) =>
  `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`

const toPx = (minutes: number) => (minutes - FIRST_HOUR * 60) * PX_PER_MINUTE

const overlaps = (a: CalendarEvent, b: CalendarEvent) =>
  a.start < b.start + b.minutes && b.start < a.start + a.minutes

/** The lane is null when the event has the full width of the timeline. */
function laneOf(event: CalendarEvent, events: CalendarEvent[]) {
  const others = events.filter((e) => e !== event && overlaps(e, event))
  if (others.length === 0) return null
  return others.some((e) => e.start < event.start) ? 'right' : 'left'
}

interface TimelineProps {
  events: CalendarEvent[]
  onOpenCalendar: () => void
}

export function Timeline({ events, onOpenCalendar }: TimelineProps) {
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
              lane={laneOf(event, events)}
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
}

function EventBlock({ event, lane }: EventBlockProps) {
  const twoLine = event.minutes >= TWO_LINE_MIN_MINUTES
  const source = sourceLabel(event.source)
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
        top: toPx(event.start) + EVENT_INSET,
        height: event.minutes * PX_PER_MINUTE - 2 * EVENT_INSET,
      }}
    >
      {twoLine ? (
        <>
          <span className="event-title">{event.title}</span>
          <span className="event-meta">
            {event.time}  ·  {event.status ?? source}
          </span>
        </>
      ) : (
        <span className="event-line">
          {event.title}  ·  {event.time}
          {lane ? '' : `  ·  ${source}`}
        </span>
      )}
      {event.conflict && (
        <span className="event-flag" role="img" aria-label="Conflict">
          !
        </span>
      )}
    </li>
  )
}
