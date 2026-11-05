import { Moon, RefreshCw, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEMO_DAY } from '../data'
import type { Theme } from '../useTheme'

const SYNC_DURATION_MS = 1200

interface HeaderProps {
  title: string
  date: string
  theme: Theme
  onToggleTheme: () => void
}

export function Header({ title, date, theme, onToggleTheme }: HeaderProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(DEMO_DAY.syncedAt)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const sync = () => {
    setSyncing(true)
    timer.current = setTimeout(() => {
      setSyncing(false)
      setSyncedAt(DEMO_DAY.syncedAfterRefresh)
    }, SYNC_DURATION_MS)
  }

  const ThemeIcon = theme === 'dark' ? Sun : Moon

  return (
    <header className="header">
      <div>
        <h1>{title}</h1>
        <p className="header-date">{date}</p>
      </div>
      <div className="header-actions">
        <span className="header-synced" role="status">
          {syncing ? 'Syncing...' : `Synced ${syncedAt}`}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={onToggleTheme}
        >
          <ThemeIcon size={18} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
        </button>
        <button
          type="button"
          className="sync-button"
          disabled={syncing}
          onClick={sync}
        >
          <RefreshCw
            size={16}
            strokeWidth={1.75}
            absoluteStrokeWidth
            className={syncing ? 'spin' : undefined}
            aria-hidden
          />
          Sync Now
        </button>
      </div>
    </header>
  )
}
