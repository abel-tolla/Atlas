import { addHours, format, isSameDay, parseISO, setHours, startOfDay, startOfHour } from 'date-fns'
import { CalendarPlus, CloudOff, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createEvent,
  deleteEvent,
  getEvent,
  historyFor,
  mockMode,
  moveEvent,
  resolveConflict,
  setLocal,
  updateEvent,
  type EventInput,
} from '../../calendarApi'
import { DEMO_DAY, type CalendarEvent, type Source } from '../../data'
import {
  DEMO_NOW,
  daysIn,
  rangeFor,
  rangeLabel,
  shiftAnchor,
  type CalendarMode,
} from '../../time'
import { useEvents } from '../../useEvents'
import { CalendarToolbar } from './CalendarToolbar'
import { ConflictDialog } from './ConflictDialog'
import { EventDetails, SOURCE_APP } from './EventDetails'
import { EventForm } from './EventForm'
import { MonthGrid } from './MonthGrid'
import { Legend, SourceMark, eventLabel, shortTime } from './parts'
import { Popover } from './Popover'
import { TimeGrid } from './TimeGrid'

type Open =
  | { kind: 'event'; id: string; anchor: DOMRect; from: HTMLElement }
  | { kind: 'more'; events: CalendarEvent[]; anchor: DOMRect; from: HTMLElement }

interface CalendarViewProps {
  mode: CalendarMode
  anchor: Date
  onModeChange: (mode: CalendarMode) => void
  onAnchorChange: (anchor: Date) => void
  onNotify: (message: string) => void
  onConnect: () => void
}

const ICON = { size: 20, strokeWidth: 1.75, absoluteStrokeWidth: true, 'aria-hidden': true } as const

const appName = (source: Source) =>
  source === 'atlas' ? 'Atlas' : SOURCE_APP[source]

const conflictNote = (event: CalendarEvent | undefined) => {
  const names = (event?.conflictsWith ?? []).map((id) => getEvent(id)?.title).filter(Boolean)
  return names.length > 0 ? ` It now overlaps ${names.join(', ')}.` : ''
}

function focusEvent(id: string) {
  document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`)?.focus()
}

export function CalendarView({
  mode,
  anchor,
  onModeChange,
  onAnchorChange,
  onNotify,
  onConnect,
}: CalendarViewProps) {
  const range = useMemo(() => rangeFor(mode, anchor), [mode, anchor])
  const days = useMemo(() => daysIn(range), [range])
  const { events: loaded, status, error, loading, retry } = useEvents(range)
  const [showHidden, setShowHidden] = useState(false)
  const [open, setOpen] = useState<Open | null>(null)
  const [form, setForm] = useState<{ event?: CalendarEvent; start?: Date } | null>(null)
  const [conflict, setConflict] = useState<{ a: string; b: string } | null>(null)

  const events = useMemo(
    () => (showHidden ? loaded : loaded.filter((e) => !e.hidden)),
    [loaded, showHidden],
  )
  const hiddenCount = loaded.filter((e) => e.hidden).length
  const find = (id: string) => loaded.find((e) => e.id === id) ?? getEvent(id)

  // A new range closes whatever was open for the old one.
  useEffect(() => setOpen(null), [range])

  // Performance check (#76): with ?mock=stress, log how long a range takes to show.
  const requestedAt = useRef(performance.now())
  useEffect(() => {
    requestedAt.current = performance.now()
  }, [range])
  useEffect(() => {
    if (!loading && mockMode() === 'stress') {
      const ms = Math.round(performance.now() - requestedAt.current)
      console.info(`[perf] ${mode} with ${loaded.length} events on screen in ${ms} ms`)
    }
  }, [loading, loaded.length, mode])

  const openedEvent = open?.kind === 'event' ? find(open.id) : undefined
  useEffect(() => {
    if (open?.kind === 'event' && !openedEvent) setOpen(null)
  }, [open, openedEvent])

  const openEvent = (id: string, from: HTMLElement) =>
    setOpen({ kind: 'event', id, anchor: from.getBoundingClientRect(), from })

  const closePopover = () => {
    const from = open?.from
    setOpen(null)
    if (from?.isConnected) from.focus()
  }

  const openDay = (day: Date) => {
    onAnchorChange(day)
    onModeChange('day')
  }

  const newEventStart = () =>
    isSameDay(anchor, DEMO_NOW)
      ? startOfHour(addHours(DEMO_NOW, 1))
      : setHours(startOfDay(anchor), 9)

  const fail = (err: unknown) => onNotify((err as Error).message)

  // Keyboard shortcuts (#73, #75). Skipped while typing or inside a dialog.
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {})
  shortcuts.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, [contenteditable], dialog, .popover')) return
    if (document.querySelector('dialog[open]') || form || conflict) return
    const actions: Record<string, () => void> = {
      t: () => onAnchorChange(DEMO_NOW),
      d: () => onModeChange('day'),
      w: () => onModeChange('week'),
      m: () => onModeChange('month'),
      c: () => setForm({ start: newEventStart() }),
      j: () => onAnchorChange(shiftAnchor(mode, anchor, 1)),
      k: () => onAnchorChange(shiftAnchor(mode, anchor, -1)),
      arrowright: () => onAnchorChange(shiftAnchor(mode, anchor, 1)),
      arrowleft: () => onAnchorChange(shiftAnchor(mode, anchor, -1)),
    }
    const action = actions[e.key.toLowerCase()]
    if (!action) return
    e.preventDefault()
    action()
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => shortcuts.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const save = async (input: EventInput, important: boolean) => {
    if (form?.event) {
      const id = form.event.id
      await updateEvent(id, input)
      await setLocal(id, 'important', important || undefined)
      onNotify(`Saved ${input.title}.${conflictNote(getEvent(id))}`)
      setForm(null)
      requestAnimationFrame(() => focusEvent(id))
      return
    }
    const created = await createEvent(input, important ? { important: true } : {})
    onNotify(`Added ${created.title}.${conflictNote(created)}`)
    setForm(null)
    const start = parseISO(created.start)
    if (start < range.start || start >= range.end) onAnchorChange(start)
  }

  const move = (event: CalendarEvent, start: string, end: string) =>
    moveEvent(event.id, start, end)
      .then((moved) => {
        onNotify(
          `Moved ${moved.title} to ${format(parseISO(start), "EEE 'at' h:mm a")}.${conflictNote(moved)}`,
        )
        requestAnimationFrame(() => focusEvent(moved.id))
      })
      .catch(fail)

  const refuseMove = (event: CalendarEvent) =>
    onNotify(
      `${event.title} comes from ${appName(event.source)}. Move it there, and Atlas picks it up on the next sync.`,
    )

  const conflictPair = conflict
    ? ([find(conflict.a), find(conflict.b)] as const)
    : undefined

  const grid =
    mode === 'month' ? (
      <MonthGrid
        key={format(anchor, 'yyyy-MM')}
        anchor={anchor}
        days={days}
        events={events}
        loading={loading}
        onOpenEvent={openEvent}
        onOpenDay={openDay}
      />
    ) : (
      <TimeGrid
        key={mode}
        days={days}
        events={events}
        loading={loading}
        linkDays={mode === 'week'}
        onOpenEvent={openEvent}
        onOpenMore={(group, from) =>
          setOpen({ kind: 'more', events: group, anchor: from.getBoundingClientRect(), from })
        }
        onOpenDay={openDay}
        onCreateAt={(start) => setForm({ start })}
        onMove={move}
        onRefuseMove={refuseMove}
      />
    )

  return (
    <section className="calendar" aria-label="Calendar">
      <CalendarToolbar
        mode={mode}
        label={rangeLabel(mode, anchor)}
        showHidden={showHidden}
        hiddenCount={hiddenCount}
        onToday={() => onAnchorChange(DEMO_NOW)}
        onStep={(step) => onAnchorChange(shiftAnchor(mode, anchor, step))}
        onMode={onModeChange}
        onToggleHidden={() => setShowHidden((value) => !value)}
        onCreate={() => setForm({ start: newEventStart() })}
      />
      <Legend />

      {error && (
        <div className="cal-state card" role="alert" data-tone="danger">
          <span className="orb">
            <TriangleAlert {...ICON} />
          </span>
          <div>
            <h3>Your calendar didn’t load</h3>
            <p className="item-meta">{error} Your events are safe. Try again in a moment.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {status === 'no-calendars' && (
        <div className="cal-state card" data-tone="brand">
          <span className="orb">
            <CalendarPlus {...ICON} />
          </span>
          <div>
            <h3>Connect a calendar to get started</h3>
            <p className="item-meta">
              Atlas shows Google, Microsoft, Canvas and Apple events together. It only reads them.
            </p>
          </div>
          <button type="button" className="btn btn--primary" onClick={onConnect}>
            Connect a calendar
          </button>
        </div>
      )}

      {status === 'delayed' && (
        <div className="cal-banner" role="status" data-tone="warning">
          <CloudOff {...ICON} size={16} />
          <p>
            Sync delayed. Google Calendar hasn’t answered since {DEMO_DAY.syncedAt}, so these are
            the events saved then.
          </p>
          <button type="button" className="link" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {!error && <div className="calendar-grid card">{grid}</div>}

      <p className="cal-hint">
        Shortcuts: T today, D / W / M switch view, J / K next and previous, C new event. Alt + arrow
        keys move a focused Atlas event.
      </p>

      {open?.kind === 'event' && openedEvent && (
        <Popover anchor={open.anchor} labelledBy={`event-${openedEvent.id}-title`} onClose={closePopover}>
          <EventDetails
            key={openedEvent.id}
            event={openedEvent}
            partners={openedEvent.conflictsWith
              .map(find)
              .filter((e): e is CalendarEvent => Boolean(e))}
            history={historyFor(openedEvent.id)}
            onClose={closePopover}
            onEdit={() => {
              setOpen(null)
              setForm({ event: openedEvent })
            }}
            onDelete={() => {
              setOpen(null)
              deleteEvent(openedEvent.id)
                .then(() => onNotify(`Deleted ${openedEvent.title}.`))
                .catch(fail)
            }}
            onSetLocal={(key, value, reason) => {
              setLocal(openedEvent.id, key, value as never, reason)
                .then(() => {
                  if (key === 'hidden' && value && !showHidden) {
                    onNotify(`${openedEvent.title} is hidden. Use Show hidden to see it.`)
                  }
                  if (key === 'notes') onNotify('Note saved.')
                })
                .catch(fail)
            }}
            onResolve={(partnerId) => {
              setOpen(null)
              setConflict({ a: openedEvent.id, b: partnerId })
            }}
          />
        </Popover>
      )}

      {open?.kind === 'more' && (
        <Popover anchor={open.anchor} labelledBy="more-title" onClose={closePopover}>
          <div className="details">
            <div className="details-head">
              <h2 id="more-title">{open.events.length} events at this time</h2>
            </div>
            <ul className="more-list">
              {open.events.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className="cal-chip"
                    data-source={event.source}
                    aria-label={eventLabel(event)}
                    onClick={() => openEvent(event.id, open.from)}
                  >
                    <SourceMark source={event.source} />
                    <span className="cal-chip-time">{shortTime(event)}</span>
                    <span className="cal-chip-title">{event.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Popover>
      )}

      {form && (
        <EventForm
          event={form.event}
          start={form.start}
          onSave={save}
          onClose={() => {
            const id = form.event?.id
            setForm(null)
            if (id) requestAnimationFrame(() => focusEvent(id))
          }}
        />
      )}

      {conflict && conflictPair?.[0] && conflictPair[1] && (
        <ConflictDialog
          a={conflictPair[0]}
          b={conflictPair[1]}
          onClose={() => {
            setConflict(null)
            requestAnimationFrame(() => focusEvent(conflict.a))
          }}
          onChoose={(keepId) => {
            const [a, b] = conflictPair as [CalendarEvent, CalendarEvent]
            setConflict(null)
            resolveConflict(a.id, b.id, keepId)
              .then(() => {
                if (keepId === null) onNotify(`Both stay on your calendar.`)
                else {
                  const [kept, lost] = keepId === a.id ? [a, b] : [b, a]
                  onNotify(`Kept ${kept.title}. ${lost.title} is hidden.`)
                }
                requestAnimationFrame(() => focusEvent(keepId ?? a.id))
              })
              .catch(fail)
          }}
        />
      )}
    </section>
  )
}
