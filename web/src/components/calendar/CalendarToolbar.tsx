import { ChevronLeft, ChevronRight, Eye, EyeOff, Plus } from 'lucide-react'
import type { CalendarMode } from '../../time'

const MODES: { mode: CalendarMode; label: string; key: string }[] = [
  { mode: 'day', label: 'Day', key: 'D' },
  { mode: 'week', label: 'Week', key: 'W' },
  { mode: 'month', label: 'Month', key: 'M' },
]

const ICON = { size: 16, strokeWidth: 1.75, absoluteStrokeWidth: true, 'aria-hidden': true } as const

interface CalendarToolbarProps {
  mode: CalendarMode
  label: string
  showHidden: boolean
  hiddenCount: number
  onToday: () => void
  onStep: (step: 1 | -1) => void
  onMode: (mode: CalendarMode) => void
  onToggleHidden: () => void
  onCreate: () => void
}

/** Today, previous and next, the view switcher (#69), and the hidden toggle (#87). */
export function CalendarToolbar({
  mode,
  label,
  showHidden,
  hiddenCount,
  onToday,
  onStep,
  onMode,
  onToggleHidden,
  onCreate,
}: CalendarToolbarProps) {
  return (
    <div className="cal-toolbar">
      <div className="cal-nav">
        <button
          type="button"
          className="btn"
          title="Today (T)"
          aria-keyshortcuts="T"
          onClick={onToday}
        >
          Today
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Previous ${mode}`}
          title="Previous (K)"
          aria-keyshortcuts="K ArrowLeft"
          onClick={() => onStep(-1)}
        >
          <ChevronLeft {...ICON} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Next ${mode}`}
          title="Next (J)"
          aria-keyshortcuts="J ArrowRight"
          onClick={() => onStep(1)}
        >
          <ChevronRight {...ICON} />
        </button>
        <h2 className="cal-range" aria-live="polite">
          {label}
        </h2>
      </div>

      <div className="cal-tools">
        <div className="segments cal-modes" role="group" aria-label="Calendar view">
          {MODES.map(({ mode: item, label: text, key }) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              title={`${text} (${key})`}
              aria-keyshortcuts={key}
              onClick={() => onMode(item)}
            >
              {text}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn cal-hidden-toggle"
          aria-pressed={showHidden}
          onClick={onToggleHidden}
        >
          {showHidden ? <Eye {...ICON} size={14} /> : <EyeOff {...ICON} size={14} />}
          {showHidden ? 'Showing hidden' : 'Show hidden'}
          {hiddenCount > 0 && <span className="cal-count">{hiddenCount}</span>}
        </button>
        <button
          type="button"
          className="btn btn--primary cal-new"
          title="New event (C)"
          aria-keyshortcuts="C"
          onClick={onCreate}
        >
          <Plus {...ICON} size={14} />
          New event
        </button>
      </div>
    </div>
  )
}
