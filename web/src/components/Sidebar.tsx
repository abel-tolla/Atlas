import {
  Calendar,
  CalendarClock,
  ListChecks,
  LogOut,
  Repeat,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { SOURCES } from '../data'
import { logOut } from '../lib/auth/actions'
import type { CurrentUser } from '../lib/auth/current-user'
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

/** Up to two letters: the first letters of the first and last name, or of the email. */
export function initials({ name, email }: Pick<CurrentUser, 'name' | 'email'>): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const letters =
    words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? email).slice(0, 2)
  return letters.toUpperCase()
}

export function Sidebar({ view, user }: { view: View; user: CurrentUser }) {
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
        {user.image ? (
          // A Google or Microsoft picture, so next/image would need every host listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={user.image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar" aria-hidden>
            {initials(user)}
          </span>
        )}
        <div className="account-text">
          <p className="account-name">{user.name ?? user.email}</p>
          <p className="account-plan">Free plan</p>
        </div>
        <form action={logOut}>
          <button className="account-logout" aria-label="Log out" title="Log out">
            <LogOut size={18} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  )
}
