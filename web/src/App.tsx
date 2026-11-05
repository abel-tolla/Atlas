import { useEffect, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { Inbox, type ConflictChoice } from './components/Inbox'
import { Placeholder } from './components/Placeholder'
import { Sidebar, type View } from './components/Sidebar'
import { TasksDue } from './components/TasksDue'
import { Timeline } from './components/Timeline'
import { DEMO_DAY, EVENTS, INBOX, type InboxId } from './data'
import { useTheme } from './useTheme'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<View>('Today')
  const [events, setEvents] = useState(EVENTS)
  const [inbox, setInbox] = useState(INBOX)
  const [doneTasks, setDoneTasks] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const composerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const resolve = (id: InboxId, message: string) => {
    setInbox((items) => items.filter((item) => item !== id))
    setToast(message)
  }

  const resolveConflict = (choice: ConflictChoice) => {
    const hidden = { study: 'shift', shift: 'study', both: null }[choice]
    setEvents((items) =>
      items
        .filter((event) => event.id !== hidden)
        .map((event) => ({ ...event, conflict: false })),
    )
    resolve(
      'conflict',
      {
        study: 'Kept the study block. Part-time shift is hidden.',
        shift: 'Kept the shift. Haskell study is removed.',
        both: 'Both stay on your calendar.',
      }[choice],
    )
  }

  const trackBlock = (outcome: string) => {
    setEvents((items) =>
      items.map((event) =>
        event.id === 'sprint' ? { ...event, status: 'Tracked' } : event,
      ),
    )
    resolve('tracking', `Atlas sprint tickets tracked: ${outcome}.`)
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
                items={inbox}
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
              <Timeline
                events={events}
                onOpenCalendar={() => setView('Calendar')}
              />
              <TasksDue done={doneTasks} onToggle={toggleTask} />
            </div>
          </div>
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
