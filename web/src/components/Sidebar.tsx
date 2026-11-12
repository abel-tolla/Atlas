import {
  Calendar,
  CalendarClock,
  ListChecks,
  Repeat,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { SOURCES } from '../data'
import { AtlasLogo } from './AtlasLogo'

export type View =
  | 'Today'
  | 'Calendar'
  | 'Schedule'
  | 'Tasks'
  | 'Routines'
  | 'Settings'

export const NAV: { view: View; href: string; icon: LucideIcon }[] = [
  { view: 'Today', href: '/', icon: Sun },
  { view: 'Calendar', href: '/calendar', icon: Calendar },
  { view: 'Schedule', href: '/schedule', icon: CalendarClock },
  { view: 'Tasks', href: '/tasks', icon: ListChecks },
  { view: 'Routines', href: '/routines', icon: Repeat },
  { view: 'Settings', href: '/settings', icon: Settings },
]

/** Which view a path belongs to, for the header and the active nav item. */
export function viewFor(pathname: string): View {
  const match = NAV.find(({ href }) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`),
  )
  return match?.view ?? 'Today'
}

export function Sidebar({ view }: { view: View }) {
  return (
    <aside className="sidebar card">
      <AtlasLogo />
      <nav className="nav" aria-label="Main">
        {NAV.map(({ view: item, href, icon: Icon }) => (
          <Link
            key={item}
            href={href}
            className="nav-item"
            aria-current={view === item ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
            {item}
          </Link>
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
