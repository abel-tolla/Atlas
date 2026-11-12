import { parseISO } from 'date-fns'
import { sourceLabel, type CalendarEvent } from '../../data'
import { formatEventWhen } from '../../time'
import { Dialog } from './Dialog'
import { SourceMark } from './parts'

interface ConflictDialogProps {
  a: CalendarEvent
  b: CalendarEvent
  onChoose: (keepId: string | null) => void
  onClose: () => void
}

/**
 * Only the user knows which event matters more (#93). Keeping one hides the
 * other. "Both are fine" clears the marker and keeps both.
 */
export function ConflictDialog({ a, b, onChoose, onClose }: ConflictDialogProps) {
  const from = parseISO(a.start > b.start ? a.start : b.start)
  const to = parseISO(a.end < b.end ? a.end : b.end)
  const overlapMinutes = Math.round((to.getTime() - from.getTime()) / 60_000)

  return (
    <Dialog overline="Conflict" title={`${a.title} overlaps ${b.title}`} onClose={onClose}>
      <p className="dialog-text">
        They overlap for {overlapMinutes} minutes. Pick the one to keep, and Atlas hides the other.
        You can show it again from the hidden events.
      </p>
      <ul className="conflict-events">
        {[a, b].map((event) => (
          <li key={event.id} data-source={event.source}>
            <SourceMark source={event.source} />
            <div>
              <p className="conflict-title">{event.title}</p>
              <p className="item-meta">
                {formatEventWhen(event)}  ·  {sourceLabel(event.source)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="item-actions">
        <button type="button" className="btn" onClick={() => onChoose(a.id)}>
          Keep {a.title}
        </button>
        <button type="button" className="btn" onClick={() => onChoose(b.id)}>
          Keep {b.title}
        </button>
        <button type="button" className="btn btn--text" onClick={() => onChoose(null)}>
          Both are fine
        </button>
      </div>
    </Dialog>
  )
}
