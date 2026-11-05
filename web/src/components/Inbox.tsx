import { CalendarX, Check, Sparkles, Unplug } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { PROPOSED_BLOCKS, type InboxId } from '../data'

export type ConflictChoice = 'study' | 'shift' | 'both'

interface InboxProps {
  items: InboxId[]
  onApprove: () => void
  onModify: () => void
  onDismiss: () => void
  onResolveConflict: (choice: ConflictChoice) => void
  onTrack: (outcome: string) => void
  onReconnect: () => void
}

export function Inbox({
  items,
  onApprove,
  onModify,
  onDismiss,
  onResolveConflict,
  onTrack,
  onReconnect,
}: InboxProps) {
  return (
    <section aria-labelledby="inbox-heading">
      <div className="inbox-head">
        <h2 id="inbox-heading">Inbox</h2>
        {items.length > 0 && (
          <span className="inbox-count" aria-label={`${items.length} items`}>
            {items.length}
          </span>
        )}
        <span className="inbox-grouping">Grouped by type</span>
      </div>

      {items.length === 0 && (
        <p className="inbox-empty card">You are all caught up.</p>
      )}

      <div className="inbox-list">
        {items.includes('proposal') && (
          <Item
            tone="ai"
            icon={<Sparkles size={20} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />}
            label="AI proposal"
            title="Haskell quiz prep: 3 work blocks"
          >
            <ul className="block-chips">
              {PROPOSED_BLOCKS.map((block) => (
                <li key={block}>{block}</li>
              ))}
            </ul>
            <div className="item-actions">
              <button type="button" className="btn btn--primary" onClick={onApprove}>
                Approve
              </button>
              <button type="button" className="btn" onClick={onModify}>
                Modify
              </button>
              <button type="button" className="btn btn--text" onClick={onDismiss}>
                Dismiss
              </button>
            </div>
          </Item>
        )}

        {items.includes('conflict') && (
          <Item
            tone="danger"
            icon={<CalendarX size={20} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />}
            label="Conflict"
            title="Haskell study overlaps Part-time shift"
          >
            <p className="item-meta">Today, 4:00 - 5:00 PM</p>
            <div className="item-actions item-actions--tight">
              <button type="button" className="btn" onClick={() => onResolveConflict('study')}>
                Keep study block
              </button>
              <button type="button" className="btn" onClick={() => onResolveConflict('shift')}>
                Keep shift
              </button>
              <button type="button" className="btn btn--text" onClick={() => onResolveConflict('both')}>
                Both are fine
              </button>
            </div>
          </Item>
        )}

        {items.includes('tracking') && <TrackingItem onTrack={onTrack} />}

        {items.includes('connection') && (
          <Item
            tone="warning"
            icon={<Unplug size={20} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />}
            label="Connection expired"
            title="Apple Calendar needs re-authentication"
            compact
            aside={
              <button type="button" className="btn btn--primary" onClick={onReconnect}>
                Reconnect
              </button>
            }
          >
            <p className="item-meta">Cached events are still showing</p>
          </Item>
        )}
      </div>
    </section>
  )
}

function TrackingItem({ onTrack }: { onTrack: (outcome: string) => void }) {
  const [editingMinutes, setEditingMinutes] = useState(false)
  const [minutes, setMinutes] = useState('90')

  const submitMinutes = (event: FormEvent) => {
    event.preventDefault()
    if (Number(minutes) > 0) onTrack(`${minutes} min`)
  }

  return (
    <Item
      tone="brand"
      icon={<Check size={20} strokeWidth={2.2} absoluteStrokeWidth aria-hidden />}
      label="How did it go?"
      title="Atlas sprint tickets"
      aside={
        <div className="tracking">
          <div className="segments" role="group" aria-label="How long it took">
            {['Faster', 'About right', 'Longer'].map((feel) => (
              <button key={feel} type="button" onClick={() => onTrack(feel.toLowerCase())}>
                {feel}
              </button>
            ))}
          </div>
          {editingMinutes ? (
            <form className="minutes" onSubmit={submitMinutes}>
              <input
                type="number"
                min="1"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                aria-label="Exact minutes"
                autoFocus
              />
              <button type="submit" className="link">
                Save
              </button>
            </form>
          ) : (
            <div className="tracking-links">
              <button type="button" className="link" onClick={() => onTrack('partial')}>
                Partial
              </button>
              <span aria-hidden>·</span>
              <button type="button" className="link" onClick={() => onTrack('skipped')}>
                Skipped
              </button>
              <span aria-hidden>·</span>
              <button type="button" className="link" onClick={() => setEditingMinutes(true)}>
                Exact minutes
              </button>
            </div>
          )}
        </div>
      }
    >
      <p className="item-meta">12:00 - 1:30 PM  ·  planned 90 min</p>
    </Item>
  )
}

interface ItemProps {
  tone: 'ai' | 'brand' | 'danger' | 'warning'
  icon: ReactNode
  label: string
  title: string
  compact?: boolean
  aside?: ReactNode
  children: ReactNode
}

function Item({ tone, icon, label, title, compact, aside, children }: ItemProps) {
  return (
    <article className={`inbox-item card${compact ? ' inbox-item--compact' : ''}`} data-tone={tone}>
      <span className="orb">{icon}</span>
      <div className="item-body">
        <p className="overline item-label">{label}</p>
        <h3>{title}</h3>
        {children}
      </div>
      {aside && <div className="item-aside">{aside}</div>}
    </article>
  )
}
