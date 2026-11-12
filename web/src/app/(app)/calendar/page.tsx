import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CalendarPage } from '../../../components/calendar/CalendarPage'

export const metadata: Metadata = { title: 'Calendar · Atlas' }

export default function Calendar() {
  // CalendarPage reads the address, which needs a Suspense boundary.
  return (
    <Suspense>
      <CalendarPage />
    </Suspense>
  )
}
