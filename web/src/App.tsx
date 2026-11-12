import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CalendarView } from './components/calendar/CalendarView'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { Inbox, type ConflictChoice } from './components/Inbox'
import { Placeholder } from './components/Placeholder'
import { Sidebar, type View } from './components/Sidebar'
import { TasksDue } from './components/TasksDue'
import { Timeline } from './components/Timeline'
import {
  eventsOnDay,
  getVersion,
  resolveConflict as saveResolution,
  subscribe,
  updateEvent,
} from './calendarApi'
import { DEMO_DAY, INBOX, type InboxId } from './data'
import { DEMO_NOW, type CalendarMode } from './time'
import { useTheme } from './useTheme'

const TOAST_MS = 4000

/** Phones start on Day, since seven columns don't fit (#73). */
const defaultMode = (): CalendarMode =>
  window.matchMedia('(max-width: 760px)').matches ? 'day' : 'week'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<View>('Today')
  const [calendarMode, setCalendarMode] = useState(defaultMode)
  const [calendarAnchor, setCalendarAnchor] = useState(DEMO_NOW)
  // Today and the calendar read the same store, so a change in one shows in both.
  const version = useSyncExternalStore(subscribe, getVersion)
  const events = useMemo(() => eventsOnDay(DEMO_NOW), [version])
  const [inbox, setInbox] = useState(INBOX)
  const [doneTasks, setDoneTasks] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const composerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // Conflicts are computed from the data, so the inbox card goes away
  // however the clash gets resolved.
  const studyClash = events
    .find((event) => event.id === 'study')
    ?.conflictsWith.includes('shift')
  const inboxItems = inbox.filter((item) => item !== 'conflict' || studyClash)

  const resolve = (id: InboxId, message: string) => {
    setInbox((items) => items.filter((item) => item !== id))
    setToast(message)
  }

  const resolveConflict = (choice: ConflictChoice) => {
    const keep = { study: 'study', shift: 'shift', both: null }[choice]
    saveResolution('study', 'shift', keep)
    resolve(
      'conflict',
      {
        study: 'Kept the study block. Part-time shift is hidden.',
        shift: 'Kept the shift. Haskell study is hidden.',
        both: 'Both stay on your calendar.',
      }[choice],
    )
  }

  const trackBlock = (outcome: string) => {
    updateEvent('sprint', { status: 'Tracked' })
    resolve('tracking', `Atlas sprint tickets tracked: ${outcome}.`)
  }

  const openCalendar = () => {
    setCalendarAnchor(DEMO_NOW)
    setView('Calendar')
  }

  const modifyProposal = () => {
    setDraft('Change the Haskell quiz prep blocks: ')
    composerInput.current?.focus()
  }

  const toggleTask = (id: string) => {
    setDoneTasks((done) =>
      done.includes(id) ? done.filter((task) => task !== id) : [...done, id],
    )
  }

  return (
    <div className="app">
      <Sidebar view={view} onNavigate={setView} />
      <main className="main">
        <Header
          title={view}
          date={DEMO_DAY.date}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {view === 'Today' ? (
          <div className="today">
            <div className="today-primary">
              <Composer
                draft={draft}
                onDraftChange={setDraft}
                inputRef={composerInput}
              />
              <Inbox
                items={inboxItems}
                onApprove={() =>
                  resolve('proposal', '3 work blocks added to your calendar.')
                }
                onModify={modifyProposal}
                onDismiss={() => resolve('proposal', 'Proposal dismissed.')}
                onResolveConflict={resolveConflict}
                onTrack={trackBlock}
                onReconnect={() =>
                  resolve('connection', 'Apple Calendar is connected again.')
                }
              />
            </div>
            <div className="today-secondary">
              <Timeline events={events} onOpenCalendar={openCalendar} />
              <TasksDue done={doneTasks} onToggle={toggleTask} />
            </div>
          </div>
        ) : view === 'Calendar' ? (
          <CalendarView
            mode={calendarMode}
            anchor={calendarAnchor}
            onModeChange={setCalendarMode}
            onAnchorChange={setCalendarAnchor}
            onNotify={setToast}
            onConnect={() => setView('Settings')}
          />
        ) : (
          <Placeholder view={view} onBack={() => setView('Today')} />
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
