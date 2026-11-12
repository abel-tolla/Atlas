'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { DEMO_DAY, INBOX, type InboxId } from '../data'
import { useTheme } from '../useTheme'
import { Header } from './Header'
import { Sidebar, viewFor } from './Sidebar'

const TOAST_MS = 4000

interface Shell {
  notify: (message: string) => void
  /** Demo state that lives across pages, as it did before routes existed. */
  inbox: InboxId[]
  setInbox: Dispatch<SetStateAction<InboxId[]>>
  doneTasks: string[]
  setDoneTasks: Dispatch<SetStateAction<string[]>>
}

const ShellContext = createContext<Shell | null>(null)

export function useShell() {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error('useShell must be used inside AppShell.')
  return shell
}

/** The sidebar, header and toast around every signed-in page. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const [toast, setToast] = useState('')
  const [inbox, setInbox] = useState(INBOX)
  const [doneTasks, setDoneTasks] = useState<string[]>([])
  const notify = useCallback((message: string) => setToast(message), [])
  const view = viewFor(pathname)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <ShellContext.Provider value={{ notify, inbox, setInbox, doneTasks, setDoneTasks }}>
      <div className="app">
        <Sidebar view={view} />
        <main className="main">
          <Header title={view} date={DEMO_DAY.date} theme={theme} onToggleTheme={toggleTheme} />
          {children}
        </main>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </ShellContext.Provider>
  )
}
