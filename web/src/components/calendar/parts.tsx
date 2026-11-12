import { parseISO } from 'date-fns'
import { EyeOff, Sparkle } from 'lucide-react'
import { SOURCES, sourceLabel, type CalendarEvent, type Source } from '../../data'
import { formatEventWhen, formatTime } from '../../time'

const MARK: Record<Exclude<Source, 'atlas'>, string> = {
  google: 'G',
  microsoft: 'M',
  canvas: 'C',
  apple: 'A',
}

/** A small badge per source, so color is never the only signal (#70). */
export function SourceMark({ source }: { source: Source }) {
  return (
    <span className="source-mark" data-source={source} aria-hidden>
      {source === 'atlas' ? (
        <Sparkle size={9} strokeWidth={1.5} absoluteStrokeWidth fill="currentColor" />
      ) : (
        MARK[source]
      )}
    </span>
  )
}

export function Legend() {
  return (
    <ul className="cal-legend" aria-label="Calendar colors">
      {SOURCES.map(({ id, label }) => (
        <li key={id} data-source={id}>
          <SourceMark source={id} />
          {label}
        </li>
      ))}
    </ul>
  )
}

/** The conflict marker (#91). Text, not only color. */
export function ConflictFlag() {
  return (
    <span className="cal-flag" aria-hidden title="Conflict">
      !
    </span>
  )
}

export function HiddenFlag() {
  return (
    <span className="cal-hidden-flag" aria-hidden title="Hidden">
      <EyeOff size={11} strokeWidth={2} absoluteStrokeWidth />
    </span>
  )
}

/** What a screen reader hears for an event button. */
export function eventLabel(event: CalendarEvent) {
  const parts = [
    event.title,
    formatEventWhen(event).replace(/\s+·\s+/g, ', '),
    sourceLabel(event.source),
  ]
  if (event.conflictsWith.length > 0) parts.push('conflict')
  if (event.hidden) parts.push('hidden')
  if (event.important) parts.push('important')
  return parts.join(', ')
}

export const shortTime = (event: CalendarEvent) =>
  event.allDay ? '' : formatTime(parseISO(event.start)).replace(':00', '')

export function eventClass(base: string, event: CalendarEvent) {
  return [
    base,
    event.hidden ? `${base}--hidden` : '',
    event.conflictsWith.length > 0 ? `${base}--conflict` : '',
  ]
    .filter(Boolean)
    .join(' ')
}
