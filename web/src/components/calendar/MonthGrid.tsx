import { addDays, format, isSameDay, isSameMonth } from 'date-fns'
import { useRef, useState, type KeyboardEvent } from 'react'
import type { CalendarEvent } from '../../data'
import { eventsOnDate } from '../../layout'
import { DEMO_NOW } from '../../time'
import {
  ConflictFlag,
  HiddenFlag,
  SourceMark,
  eventClass,
  eventLabel,
  shortTime,
} from './parts'

const MAX_CHIPS = 3

const MOVES: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
}

interface MonthGridProps {
  anchor: Date
  /** 42 days, six full weeks. */
  days: Date[]
  events: CalendarEvent[]
  loading: boolean
  onOpenEvent: (id: string, from: HTMLElement) => void
  onOpenDay: (day: Date) => void
}

export function MonthGrid({ anchor, days, events, loading, onOpenEvent, onOpenDay }: MonthGridProps) {
  const [focused, setFocused] = useState(anchor)
  const dayButtons = useRef(new Map<number, HTMLButtonElement>())

  /** Arrow keys move between days, so the grid works without a mouse. */
  const moveFocus = (e: KeyboardEvent, day: Date) => {
    const step = MOVES[e.key]
    if (step === undefined || e.altKey || e.metaKey || e.ctrlKey) return
    const next = addDays(day, step)
    const button = dayButtons.current.get(next.getTime())
    if (!button) return
    e.preventDefault()
    e.stopPropagation()
    setFocused(next)
    button.focus()
  }

  const focusDay = days.some((day) => isSameDay(day, focused)) ? focused : anchor

  return (
    <div className="mg" aria-busy={loading}>
      <div className="mg-weekdays" aria-hidden>
        {days.slice(0, 7).map((day) => (
          <span key={day.getTime()}>{format(day, 'EEE')}</span>
        ))}
      </div>
      <div className="mg-days">
        {days.map((day) => {
          const dayEvents = loading ? [] : eventsOnDate(events, day)
          const extra = dayEvents.length - MAX_CHIPS
          const isToday = isSameDay(day, DEMO_NOW)
          return (
            <div
              key={day.getTime()}
              className="mg-day"
              data-outside={isSameMonth(day, anchor) ? undefined : ''}
              aria-current={isToday ? 'date' : undefined}
            >
              <button
                type="button"
                className="mg-date"
                ref={(el) => {
                  if (el) dayButtons.current.set(day.getTime(), el)
                  else dayButtons.current.delete(day.getTime())
                }}
                tabIndex={isSameDay(day, focusDay) ? 0 : -1}
                aria-label={`${format(day, 'EEEE, MMMM d')}${isToday ? ', today' : ''}, ${
                  dayEvents.length === 1 ? '1 event' : `${dayEvents.length} events`
                }. Open day.`}
                onFocus={() => setFocused(day)}
                onKeyDown={(e) => moveFocus(e, day)}
                onClick={() => onOpenDay(day)}
              >
                {format(day, 'd')}
              </button>

              {loading ? (
                <span className="skeleton mg-skeleton" />
              ) : (
                <ul className="mg-chips">
                  {dayEvents.slice(0, extra > 0 ? MAX_CHIPS - 1 : MAX_CHIPS).map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        className={eventClass('cal-chip', event)}
                        data-source={event.source}
                        data-event-id={event.id}
                        data-allday={event.allDay ? '' : undefined}
                        aria-label={eventLabel(event)}
                        onClick={(e) => onOpenEvent(event.id, e.currentTarget)}
                      >
                        <SourceMark source={event.source} />
                        {!event.allDay && <span className="cal-chip-time">{shortTime(event)}</span>}
                        <span className="cal-chip-title">{event.title}</span>
                        {event.conflictsWith.length > 0 && !event.hidden && <ConflictFlag />}
                        {event.hidden && <HiddenFlag />}
                      </button>
                    </li>
                  ))}
                  {extra > 0 && (
                    <li>
                      <button
                        type="button"
                        className="mg-more"
                        aria-label={`${extra + 1} more events on ${format(day, 'MMMM d')}. Open day.`}
                        onClick={() => onOpenDay(day)}
                      >
                        +{extra + 1} more
                        {dayEvents
                          .slice(MAX_CHIPS - 1)
                          .some((e) => e.conflictsWith.length > 0 && !e.hidden) && <ConflictFlag />}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
