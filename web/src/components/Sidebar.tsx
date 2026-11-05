import {
  Calendar,
  CalendarClock,
  ListChecks,
  Repeat,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { SOURCES } from '../data'
import { AtlasLogo } from './AtlasLogo'

export type View =
  | 'Today'
  | 'Calendar'
  | 'Schedule'
  | 'Tasks'
  | 'Routines'
  | 'Settings'

const NAV: { view: View; icon: LucideIcon }[] = [
  { view: 'Today', icon: Sun },
  { view: 'Calendar', icon: Calendar },
  { view: 'Schedule', icon: CalendarClock },
  { view: 'Tasks', icon: ListChecks },
  { view: 'Routines', icon: Repeat },
  { view: 'Settings', icon: Settings },
]

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
}

export function Sidebar({ view, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar card">
      <AtlasLogo />
      <nav className="nav" aria-label="Main">
        {NAV.map(({ view: item, icon: Icon }) => (
          <button
            key={item}
            type="button"
            className="nav-item"
            aria-current={view === item ? 'page' : undefined}
            onClick={() => onNavigate(item)}
          >
            <Icon size={18} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
            {item}
          </button>
        ))}
      </nav>

      <div className="calendars">
        <h2 className="overline">Calendars</h2>
        <ul>
          {SOURCES.map(({ id, label }) => (
            <li key={id} data-source={id}>
              <span className="source-dot" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="account">
        <span className="avatar" aria-hidden>
          AT
        </span>
        <div>
          <p className="account-name">Abel Tolla</p>
          <p className="account-plan">Free plan</p>
        </div>
      </div>
    </aside>
  )
}
