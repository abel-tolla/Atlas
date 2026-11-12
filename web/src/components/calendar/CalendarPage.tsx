'use client'

import { format, isValid, parse } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DEMO_NOW, type CalendarMode } from '../../time'
import { useShell } from '../AppShell'
import { CalendarView } from './CalendarView'

const MODES: CalendarMode[] = ['day', 'week', 'month']
const PHONE = '(max-width: 760px)'
const DATE_FORMAT = 'yyyy-MM-dd'

interface Position {
  /** null until the user or the screen size picks one. */
  view: CalendarMode | null
  anchor: Date
}

function fromAddress(params: URLSearchParams): Position {
  const view = params.get('view')
  const date = params.get('date')
  const parsed = date ? parse(date, DATE_FORMAT, DEMO_NOW) : null
  return {
    view: MODES.includes(view as CalendarMode) ? (view as CalendarMode) : null,
    anchor:
      parsed && isValid(parsed) && date !== format(DEMO_NOW, DATE_FORMAT) ? parsed : DEMO_NOW,
  }
}

const query = ({ view, anchor }: Position) =>
  `?${new URLSearchParams({ view: view ?? 'week', date: format(anchor, DATE_FORMAT) })}`

/**
 * The calendar's view and date live in the address, like
 * /calendar?view=week&date=2026-11-04, so a link or a refresh keeps them.
 *
 * They are held in state first and copied to the address afterwards. That
 * way quick key presses (J J, or T then W) each see the result of the last.
 */
export function CalendarPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { notify } = useShell()
  const [position, setPosition] = useState(() => fromAddress(params))
  const changed = useRef(false)

  // The address is read once, when the page opens. After that the page only
  // writes it, with replaceState, so there are no history entries to follow
  // except when the browser restores one with back or forward.
  useEffect(() => {
    const onPopState = () => setPosition(fromAddress(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Copy the position to the address once the user has changed it.
  useEffect(() => {
    if (!changed.current) return
    const next = query(position)
    if (window.location.search !== next) window.history.replaceState(null, '', `/calendar${next}`)
  }, [position])

  // Phones start on Day, since seven columns don't fit (#73).
  useEffect(() => {
    if (position.view === null && window.matchMedia(PHONE).matches) {
      setPosition((current) => ({ ...current, view: 'day' }))
    }
  }, [position.view])

  const update = (next: Partial<Position>) => {
    changed.current = true
    setPosition((current) => ({ ...current, ...next }))
  }

  return (
    <CalendarView
      mode={position.view ?? 'week'}
      anchor={position.anchor}
      onModeChange={(view) => update({ view })}
      onAnchorChange={(anchor) => update({ anchor })}
      onNotify={notify}
      onConnect={() => router.push('/settings')}
    />
  )
}
