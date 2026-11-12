import { addDays, addMinutes, format, isSameDay, parseISO } from 'date-fns'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { sourceLabel, type CalendarEvent } from '../../data'
import { layoutAllDay, layoutDay } from '../../layout'
import { DEMO_NOW, formatTimeRange, minutesOfDay, toLocalIso } from '../../time'
import {
  ConflictFlag,
  HiddenFlag,
  SourceMark,
  eventClass,
  eventLabel,
  shortTime,
} from './parts'

const HOUR_PX = 48
const PX_PER_MINUTE = HOUR_PX / 60
const SNAP_MINUTES = 15
const DRAG_THRESHOLD_PX = 4
const TALL_PX = 40
const FIRST_VISIBLE_HOUR = 7
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const hourLabel = (hour: number) =>
  hour === 0 ? '' : `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`

const shift = (iso: string, days: number, minutes: number) =>
  toLocalIso(addMinutes(addDays(parseISO(iso), days), minutes))

/** Gray blocks shown while events load, so the grid never jumps (#75). */
const SKELETON = [
  [9 * 60, 75],
  [12 * 60, 60],
  [15 * 60 + 30, 90],
]

interface Drag {
  event: CalendarEvent
  pointerId: number
  x: number
  y: number
  originDay: number
  moved: boolean
  days: number
  minutes: number
}

export interface TimeGridProps {
  days: Date[]
  events: CalendarEvent[]
  loading: boolean
  /** Week view: day headers open that day. */
  linkDays: boolean
  onOpenEvent: (id: string, from: HTMLElement) => void
  onOpenMore: (events: CalendarEvent[], from: HTMLElement) => void
  onOpenDay: (day: Date) => void
  onCreateAt: (start: Date) => void
  onMove: (event: CalendarEvent, start: string, end: string) => void
  onRefuseMove: (event: CalendarEvent) => void
}

export function TimeGrid({
  days,
  events,
  loading,
  linkDays,
  onOpenEvent,
  onOpenMore,
  onOpenDay,
  onCreateAt,
  onMove,
  onRefuseMove,
}: TimeGridProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const columns = useRef<(HTMLDivElement | null)[]>([])
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  // After a drop, the event stays where it was dropped until the save lands.
  const [pending, setPending] = useState<{ id: string; start: string; end: string } | null>(null)

  useLayoutEffect(() => {
    // A little above the hour, so its label clears the sticky header.
    if (scroller.current) scroller.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_PX - 12
  }, [])

  useEffect(() => setPending(null), [events])

  const shown = useMemo(() => {
    return events.map((event) => {
      if (drag?.moved && drag.event.id === event.id) {
        return {
          ...event,
          start: shift(event.start, drag.days, drag.minutes),
          end: shift(event.end, drag.days, drag.minutes),
        }
      }
      if (pending?.id === event.id) return { ...event, ...pending }
      return event
    })
  }, [events, drag, pending])

  const layouts = useMemo(
    () => days.map((day) => layoutDay(shown, day, { collapseAt: 3 })),
    [days, shown],
  )
  const allDay = useMemo(() => layoutAllDay(shown, days), [shown, days])
  const todayIndex = days.findIndex((day) => isSameDay(day, DEMO_NOW))

  const startDrag = (e: PointerEvent<HTMLButtonElement>, event: CalendarEvent, dayIndex: number) => {
    // Touch keeps scrolling the grid. Touch users move events from the form.
    if (e.button !== 0 || e.pointerType === 'touch') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({
      event,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      originDay: dayIndex,
      moved: false,
      days: 0,
      minutes: 0,
    })
  }

  const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    if (drag.event.readOnly) {
      suppressClick.current = true
      setDrag(null)
      onRefuseMove(drag.event)
      return
    }
    const over = columns.current.findIndex((column) => {
      const rect = column?.getBoundingClientRect()
      return rect && e.clientX >= rect.left && e.clientX < rect.right
    })
    setDrag({
      ...drag,
      moved: true,
      days: over === -1 ? drag.days : over - drag.originDay,
      minutes: Math.round(dy / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES,
    })
  }

  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    setDrag(null)
    if (!drag.moved) return
    suppressClick.current = true
    if (drag.days === 0 && drag.minutes === 0) return
    const start = shift(drag.event.start, drag.days, drag.minutes)
    const end = shift(drag.event.end, drag.days, drag.minutes)
    setPending({ id: drag.event.id, start, end })
    onMove(drag.event, start, end)
  }

  const click = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onOpenEvent(id, e.currentTarget)
  }

  /** Alt + arrow keys move an Atlas event: 15 minutes, or a day. */
  const keyMove = (e: KeyboardEvent<HTMLButtonElement>, event: CalendarEvent) => {
    if (!e.altKey) return
    const step = {
      ArrowUp: [0, -SNAP_MINUTES],
      ArrowDown: [0, SNAP_MINUTES],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }[e.key]
    if (!step) return
    e.preventDefault()
    e.stopPropagation()
    if (event.readOnly) return onRefuseMove(event)
    const [dayStep, minuteStep] = step
    onMove(event, shift(event.start, dayStep, minuteStep), shift(event.end, dayStep, minuteStep))
  }

  const createAt = (e: MouseEvent<HTMLDivElement>, day: Date) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = Math.floor((e.clientY - rect.top) / PX_PER_MINUTE / 30) * 30
    onCreateAt(addMinutes(day, minutes))
  }

  return (
    <div
      className="tg"
      data-days={days.length}
      style={{ '--days': days.length } as CSSProperties}
      aria-busy={loading}
    >
      <div className="tg-scroll" ref={scroller}>
        <div className="tg-sticky">
          <div className="tg-head">
            <span className="tg-gutter" />
            {days.map((day, index) => {
              const label = (
                <>
                  <span className="tg-weekday">{format(day, 'EEE')}</span>
                  <span className="tg-date">{format(day, 'd')}</span>
                </>
              )
              return (
                <div
                  key={day.getTime()}
                  className="tg-day"
                  aria-current={index === todayIndex ? 'date' : undefined}
                >
                  {linkDays ? (
                    <button
                      type="button"
                      className="tg-day-link"
                      aria-label={`Open ${format(day, 'EEEE, MMMM d')}`}
                      onClick={() => onOpenDay(day)}
                    >
                      {label}
                    </button>
                  ) : (
                    <span className="tg-day-link">{label}</span>
                  )}
                </div>
              )
            })}
          </div>

          {(allDay.rows > 0 || loading) && (
            <div className="tg-allday">
              <span className="tg-gutter overline">All day</span>
              <ul
                className="tg-allday-bars"
                style={{ gridTemplateRows: `repeat(${Math.max(allDay.rows, 1)}, 24px)` }}
              >
                {allDay.bars.map(({ event, start, span, row }) => (
                  <li
                    key={event.id}
                    style={{ gridColumn: `${start + 1} / span ${span}`, gridRow: row + 1 }}
                  >
                    <button
                      type="button"
                      className={eventClass('cal-bar', event)}
                      data-source={event.source}
                      data-event-id={event.id}
                      aria-label={eventLabel(event)}
                      onClick={(e) => onOpenEvent(event.id, e.currentTarget)}
                    >
                      <SourceMark source={event.source} />
                      <span className="cal-bar-title">{event.title}</span>
                      {event.hidden && <HiddenFlag />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="tg-body" style={{ height: 24 * HOUR_PX }}>
          <div className="tg-hours" aria-hidden>
            {HOURS.map((hour) => (
              <span key={hour} style={{ top: hour * HOUR_PX }}>
                {hourLabel(hour)}
              </span>
            ))}
          </div>

          {days.map((day, dayIndex) => (
            <div
              key={day.getTime()}
              ref={(el) => {
                columns.current[dayIndex] = el
              }}
              className="tg-col"
              onClick={(e) => createAt(e, day)}
            >
              {loading &&
                SKELETON.map(([start, length], i) => (
                  <span
                    key={i}
                    className="skeleton tg-skeleton"
                    style={{
                      top: (start + ((dayIndex * 45) % 120)) * PX_PER_MINUTE,
                      height: length * PX_PER_MINUTE,
                    }}
                  />
                ))}

              {!loading &&
                layouts[dayIndex].placed.map(({ event, top, height, col, cols }) => {
                  const heightPx = height * PX_PER_MINUTE
                  const tall = heightPx >= TALL_PX
                  const dragging = drag?.moved && drag.event.id === event.id
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={eventClass('cal-event', event)}
                      data-source={event.source}
                      data-event-id={event.id}
                      data-movable={event.readOnly ? undefined : ''}
                      data-dragging={dragging ? '' : undefined}
                      style={{
                        top: top * PX_PER_MINUTE + 1,
                        height: Math.max(heightPx - 2, 16),
                        left: `calc(${(col / cols) * 100}% + 1px)`,
                        width: `calc(${100 / cols}% - 3px)`,
                      }}
                      aria-label={eventLabel(event)}
                      aria-keyshortcuts={
                        event.readOnly ? undefined : 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
                      }
                      onClick={(e) => click(e, event.id)}
                      onPointerDown={(e) => startDrag(e, event, dayIndex)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={() => setDrag(null)}
                      onKeyDown={(e) => keyMove(e, event)}
                    >
                      <span className="cal-event-line">
                        <SourceMark source={event.source} />
                        <span className="cal-event-title">{event.title}</span>
                        {!tall && <span className="cal-event-time">{shortTime(event)}</span>}
                      </span>
                      {tall && (
                        <span className="cal-event-meta">
                          {formatTimeRange(parseISO(event.start), parseISO(event.end))}
                          {'  ·  '}
                          {sourceLabel(event.source)}
                        </span>
                      )}
                      {event.conflictsWith.length > 0 && !event.hidden && <ConflictFlag />}
                      {event.hidden && <HiddenFlag />}
                    </button>
                  )
                })}

              {!loading &&
                layouts[dayIndex].collapsed.map((group) => (
                  <button
                    key={group.events.map((e) => e.id).join()}
                    type="button"
                    className="cal-more"
                    style={{
                      top: group.top * PX_PER_MINUTE + 1,
                      height: Math.max(group.height * PX_PER_MINUTE - 2, 20),
                    }}
                    aria-label={`${group.hiddenCount} more overlapping events. Show all ${group.events.length}.`}
                    onClick={(e) => onOpenMore(group.events, e.currentTarget)}
                  >
                    +{group.hiddenCount} more
                    {group.events.some((e) => e.conflictsWith.length > 0) && <ConflictFlag />}
                  </button>
                ))}

              {dayIndex === todayIndex && (
                <div
                  className="tg-now"
                  style={{ top: minutesOfDay(DEMO_NOW) * PX_PER_MINUTE }}
                  aria-label={`Now, ${format(DEMO_NOW, 'h:mm a')}`}
                  role="img"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
