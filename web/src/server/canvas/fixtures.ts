// Made-up Canvas data for tests. Never real student data (FERPA).
// Only test files import this.

import type { HttpGet, HttpResponse } from './http'

export const SCHOOL = 'https://canvas.example.edu'
export const FEED_URL = `${SCHOOL}/feeds/calendars/user_pretendSecretFeedToken123.ics`

/** A feed shaped like Canvas's, with the cases a real one can hold. */
export const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Instructure//Canvas//EN',
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
  // A normal assignment, due 11:59 PM New York time, written in UTC.
  'BEGIN:VEVENT',
  'UID:event-assignment-9001',
  'SUMMARY:Haskell quiz 6 [CS 321]',
  'DTSTART:20261114T045900Z',
  'DTEND:20261114T045900Z',
  'URL:https://canvas.example.edu/courses/321/assignments/9001',
  'END:VEVENT',
  // A due date changed for this student only.
  'BEGIN:VEVENT',
  'UID:event-assignment-override-77',
  'SUMMARY:Problem set 4 (extended) [CS 455]',
  'DTSTART:20261120T045900Z',
  'URL:https://canvas.example.edu/calendar?include_contexts=course_455#assignment_9002',
  'END:VEVENT',
  // Due on a day, with no time.
  'BEGIN:VEVENT',
  'UID:event-assignment-9003',
  'SUMMARY:Reading reflection [CS 455]',
  'DTSTART;VALUE=DATE:20261118',
  'URL:https://canvas.example.edu/courses/455/assignments/9003',
  'END:VEVENT',
  // A time written in a named zone: 5 PM New York is 22:00 UTC in November.
  'BEGIN:VEVENT',
  'UID:event-assignment-9004',
  'SUMMARY:Lab report [CHEM 101]',
  'DTSTART;TZID=America/New_York:20261119T170000',
  'URL:https://canvas.example.edu/courses/101/assignments/9004',
  'END:VEVENT',
  // A course event, not an assignment: left out.
  'BEGIN:VEVENT',
  'UID:event-calendar-event-55',
  'SUMMARY:Office hours [CS 321]',
  'DTSTART:20261116T190000Z',
  'DTEND:20261116T200000Z',
  'END:VEVENT',
  // An assignment with no course link: grouped by name instead.
  'BEGIN:VEVENT',
  'UID:event-assignment-9005',
  'SUMMARY:Orientation survey [First Year Seminar]',
  'DTSTART:20261125T045900Z',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

export const json = (status: number, body: unknown, headers: HttpResponse['headers'] = {}): HttpResponse => ({
  status,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

export const text = (status: number, body: string): HttpResponse => ({ status, headers: {}, body })

type Answer = HttpResponse | Error | ((url: URL, headers: Record<string, string>) => HttpResponse)

/**
 * A pretend Canvas. Routes match on path (plus query if given). Records
 * every call, including headers, so tests can check what was sent.
 */
export function fakeCanvas(routes: Record<string, Answer>) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const get: HttpGet = async (raw, headers = {}) => {
    calls.push({ url: raw, headers })
    const url = new URL(raw)
    const answer = routes[url.pathname + url.search] ?? routes[url.pathname]
    if (!answer) return text(404, 'Not found')
    if (answer instanceof Error) throw answer
    return typeof answer === 'function' ? answer(url, headers) : answer
  }
  return { get, calls }
}
