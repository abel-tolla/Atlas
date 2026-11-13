// Reads a Canvas calendar feed link: an iCalendar (.ics) file, the standard
// text format calendars use to share events. Canvas lists each assignment
// as an event like this:
//
//   BEGIN:VEVENT
//   UID:event-assignment-456
//   SUMMARY:Haskell quiz 6 [CS 321]
//   DTSTART:20261114T045900Z
//   URL:https://school.instructure.com/courses/123/assignments/456
//   END:VEVENT
//
// The course is the [bracketed] end of the title. The course id comes from
// the link when it has one, so the same course gets the same id whether
// the user connects with a feed link or an access token.

import ICAL from 'ical.js'
import type { RemoteCalendar, RemoteEvent } from '../sync/types'

export interface ParsedFeed {
  courses: RemoteCalendar[]
  /** Assignments, keyed by the course's externalId. */
  assignments: Map<string, RemoteEvent[]>
}

/** The file isn't an iCalendar feed. */
export class FeedFormatError extends Error {
  readonly name = 'FeedFormatError'
}

const ASSIGNMENT_UID = /^event-assignment-(override-)?(\d+)$/
const TITLE_AND_COURSE = /^(.*?)\s*\[([^\]]+)\]\s*$/
const COURSE_IN_LINK = /(?:\/courses\/|[?&#=]course_)(\d+)/

export function parseCanvasFeed(text: string): ParsedFeed {
  if (!/BEGIN:VCALENDAR/.test(text)) throw new FeedFormatError('This isn’t a calendar feed.')
  let calendar: ICAL.Component
  try {
    calendar = new ICAL.Component(ICAL.parse(text))
  } catch {
    throw new FeedFormatError('This calendar feed couldn’t be read.')
  }

  // Times written with a named time zone need that zone registered first.
  for (const zone of calendar.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(zone)
  }

  const courses = new Map<string, RemoteCalendar>()
  const assignments = new Map<string, RemoteEvent[]>()

  for (const component of calendar.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(component)
    const uid = ASSIGNMENT_UID.exec(event.uid ?? '')
    // Only assignments (#192). Course events like office hours are left out for now.
    if (!uid || !event.startDate) continue

    const titled = TITLE_AND_COURSE.exec(event.summary ?? '')
    if (!titled) continue // An assignment always names its course. Skip anything else.
    const [, title, courseName] = titled

    const link = String(component.getFirstPropertyValue('url') ?? '') || undefined
    const courseId = link && COURSE_IN_LINK.exec(link)?.[1]
    const courseKey = courseId ? `course_${courseId}` : `name:${courseName}`
    if (!courses.has(courseKey)) {
      courses.set(courseKey, { externalId: courseKey, name: courseName, kind: 'course' })
      assignments.set(courseKey, [])
    }

    const start = event.startDate
    const allDay = start.isDate
    const due = allDay
      ? new Date(Date.UTC(start.year, start.month - 1, start.day))
      : new Date(start.toUnixTime() * 1000)
    assignments.get(courseKey)!.push({
      // Matches the id the Canvas API uses, so both ways of connecting share events.
      externalId: `assignment_${uid[1] ? 'override_' : ''}${uid[2]}`,
      title: title || '(No title)',
      startsAt: due,
      // An all-day deadline covers its day. A timed one is a moment.
      endsAt: allDay ? new Date(due.getTime() + 86_400_000) : due,
      allDay,
      kind: 'deadline',
      courseName,
      sourceUrl: link,
    })
  }

  return { courses: [...courses.values()], assignments }
}
