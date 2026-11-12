import { format, parseISO } from 'date-fns'
import { CalendarX, EyeOff, MapPin, Pencil, Tag, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { calendarName } from '../../calendarApi'
import {
  sourceLabel,
  type CalendarEvent,
  type HistoryEntry,
  type Priority,
  type Source,
} from '../../data'
import { formatEventWhen } from '../../time'
import { SourceMark } from './parts'

export const SOURCE_APP: Record<Exclude<Source, 'atlas'>, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Outlook',
  canvas: 'Canvas',
  apple: 'Apple Calendar',
}

const PRIORITIES: { value: Priority | undefined; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const ICON = { size: 15, strokeWidth: 1.75, absoluteStrokeWidth: true, 'aria-hidden': true } as const

type LocalKey = 'notes' | 'priority' | 'important' | 'hidden' | 'overlapFriendly'

export interface EventDetailsProps {
  event: CalendarEvent
  partners: CalendarEvent[]
  history: HistoryEntry[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onSetLocal: (key: LocalKey, value: unknown, reason?: string) => void
  onResolve: (partnerId: string) => void
}

/** The event detail popover (#71) with the user's own settings (#86). */
export function EventDetails({
  event,
  partners,
  history,
  onClose,
  onEdit,
  onDelete,
  onSetLocal,
  onResolve,
}: EventDetailsProps) {
  const [notes, setNotes] = useState(event.notes ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [reason, setReason] = useState('')
  const headingId = `event-${event.id}-title`
  const calendar = calendarName(event.calendarId)
  const notesChanged = notes.trim() !== (event.notes ?? '')

  return (
    <div className="details">
      <div className="details-head">
        <div>
          <p className="overline details-source" data-source={event.source}>
            <SourceMark source={event.source} />
            {sourceLabel(event.source)}
            {calendar && calendar !== sourceLabel(event.source) ? `  ·  ${calendar}` : ''}
          </p>
          <h2 id={headingId}>{event.title}</h2>
        </div>
        <button type="button" className="icon-button details-close" aria-label="Close" onClick={onClose}>
          <X {...ICON} size={16} />
        </button>
      </div>

      <p className="details-when">{formatEventWhen(event)}</p>
      {event.location && (
        <p className="details-row">
          <MapPin {...ICON} />
          {event.location}
        </p>
      )}
      {event.category && (
        <p className="details-row">
          <Tag {...ICON} />
          {event.category}
        </p>
      )}
      {(event.important || event.priority) && (
        <p className="details-tags">
          {event.important && <span className="tag" data-important>Important</span>}
          {event.priority && (
            <span className="tag" data-source="atlas">
              {event.priority[0].toUpperCase() + event.priority.slice(1)} priority
            </span>
          )}
        </p>
      )}

      {event.conflictsWith.length > 0 && !event.hidden && (
        <div className="details-callout" data-tone="warning">
          <CalendarX {...ICON} />
          <div>
            <p>Overlaps {partners.map((p) => p.title).join(', ') || 'another event'}</p>
            {partners.length > 0 && (
              <button type="button" className="link" onClick={() => onResolve(partners[0].id)}>
                Resolve conflict
              </button>
            )}
          </div>
        </div>
      )}

      {event.hidden && (
        <div className="details-callout" data-tone="muted">
          <EyeOff {...ICON} />
          <div>
            <p>{event.hiddenReason ?? 'Hidden'}</p>
            <button type="button" className="link" onClick={() => onSetLocal('hidden', false)}>
              Show it again
            </button>
          </div>
        </div>
      )}

      {event.readOnly && (
        <p className="details-readonly" role="note">
          This event comes from {SOURCE_APP[event.source as Exclude<Source, 'atlas'>]}. To change
          the title or time, edit it there and Atlas picks it up on the next sync. Your notes and
          settings below stay in Atlas.
        </p>
      )}

      <form
        className="details-notes"
        onSubmit={(e) => {
          e.preventDefault()
          onSetLocal('notes', notes.trim() || undefined)
        }}
      >
        <label className="overline" htmlFor={`${headingId}-notes`}>
          Notes
        </label>
        <textarea
          id={`${headingId}-notes`}
          rows={2}
          value={notes}
          placeholder="Only you can see this"
          onChange={(e) => setNotes(e.target.value)}
        />
        {notesChanged && (
          <button type="submit" className="btn details-save">
            Save note
          </button>
        )}
      </form>

      <fieldset className="details-field">
        <legend className="overline">Priority</legend>
        <div className="segments details-segments">
          {PRIORITIES.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={event.priority === value}
              onClick={() => onSetLocal('priority', value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="details-checks">
        <label>
          <input
            type="checkbox"
            checked={Boolean(event.important)}
            onChange={(e) => onSetLocal('important', e.target.checked || undefined)}
          />
          Important
        </label>
        {!event.allDay && (
          <label>
            <input
              type="checkbox"
              checked={Boolean(event.overlapFriendly)}
              onChange={(e) => onSetLocal('overlapFriendly', e.target.checked || undefined)}
            />
            Can overlap other events
          </label>
        )}
      </div>

      {hiding ? (
        <form
          className="details-confirm"
          onSubmit={(e) => {
            e.preventDefault()
            onSetLocal('hidden', true, reason.trim() || undefined)
            setHiding(false)
          }}
        >
          <label htmlFor={`${headingId}-reason`}>Why hide it? (optional)</label>
          <input
            id={`${headingId}-reason`}
            value={reason}
            placeholder="For example: I never go to these"
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <div className="item-actions item-actions--tight">
            <button type="submit" className="btn btn--primary">
              Hide event
            </button>
            <button type="button" className="btn btn--text" onClick={() => setHiding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : confirmingDelete ? (
        <div className="details-confirm" role="alert">
          <p>Delete {event.title}? This can’t be undone.</p>
          <div className="item-actions item-actions--tight">
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="btn btn--text" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="item-actions details-actions">
          {!event.readOnly && (
            <>
              <button type="button" className="btn" onClick={onEdit}>
                <Pencil {...ICON} size={14} />
                Edit
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
                <Trash2 {...ICON} size={14} />
                Delete
              </button>
            </>
          )}
          {!event.hidden && (
            <button type="button" className="btn btn--text" onClick={() => setHiding(true)}>
              Hide
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <details className="details-history">
          <summary>History ({history.length})</summary>
          <ol>
            {[...history].reverse().map((entry) => (
              <li key={entry.id}>
                <span>{entry.summary}</span>
                <time dateTime={entry.at}>{format(parseISO(entry.at), 'MMM d, h:mm a')}</time>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}
