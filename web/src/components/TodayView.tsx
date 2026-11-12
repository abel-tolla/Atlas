'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  eventsOnDay,
  getVersion,
  resolveConflict as saveResolution,
  subscribe,
  updateEvent,
} from '../calendarApi'
import type { InboxId } from '../data'
import { DEMO_NOW } from '../time'
import { useShell } from './AppShell'
import { Composer } from './Composer'
import { Inbox, type ConflictChoice } from './Inbox'
import { TasksDue } from './TasksDue'
import { Timeline } from './Timeline'

export function TodayView() {
  const router = useRouter()
  const { notify, inbox, setInbox, doneTasks, setDoneTasks } = useShell()
  // Today and the calendar read the same store, so a change in one shows in both.
  const version = useSyncExternalStore(subscribe, getVersion, getVersion)
  const events = useMemo(() => eventsOnDay(DEMO_NOW), [version])
  const [draft, setDraft] = useState('')
  const composerInput = useRef<HTMLInputElement>(null)

  // Conflicts are computed from the data, so the inbox card goes away
  // however the clash gets resolved.
  const studyClash = events
    .find((event) => event.id === 'study')
    ?.conflictsWith.includes('shift')
  const inboxItems = inbox.filter((item) => item !== 'conflict' || studyClash)

  const resolve = (id: InboxId, message: string) => {
    setInbox((items) => items.filter((item) => item !== id))
    notify(message)
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
    <div className="today">
      <div className="today-primary">
        <Composer draft={draft} onDraftChange={setDraft} inputRef={composerInput} />
        <Inbox
          items={inboxItems}
          onApprove={() => resolve('proposal', '3 work blocks added to your calendar.')}
          onModify={modifyProposal}
          onDismiss={() => resolve('proposal', 'Proposal dismissed.')}
          onResolveConflict={resolveConflict}
          onTrack={trackBlock}
          onReconnect={() => resolve('connection', 'Apple Calendar is connected again.')}
        />
      </div>
      <div className="today-secondary">
        <Timeline events={events} onOpenCalendar={() => router.push('/calendar')} />
        <TasksDue done={doneTasks} onToggle={toggleTask} />
      </div>
    </div>
  )
}
