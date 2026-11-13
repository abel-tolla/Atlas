import { describe, expect, it } from 'vitest'
import { ProviderUnavailableError, ReauthRequiredError, type RemoteCalendar } from '../sync/types'
import { FEED_REJECTED, TOKEN_REJECTED, fetchAssignments, fetchCourses, fetchFeed, fetchSelf } from './api'
import { createCanvasAdapter } from './adapter'
import { FeedFormatError, parseCanvasFeed } from './feed'
import { FEED, FEED_URL, SCHOOL, fakeCanvas, json, text } from './fixtures'
import { NetworkError, UnsafeAddressError, checkAddress, httpsGet, isPublicAddress } from './http'

const window = { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2027-05-01T00:00:00Z') }
const cs321: RemoteCalendar = { externalId: 'course_321', name: 'CS 321', kind: 'course' }

describe('address safety (SSRF)', () => {
  it.each([
    ['8.8.8.8', true],
    ['151.101.1.1', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.20.0.1', false],
    ['192.168.1.10', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['::1', false],
    ['[::1]', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:10.0.0.1', false],
    ['::ffff:7f00:1', false],
    ['::ffff:a9fe:a9fe', false],
    ['::ffff:808:808', true],
    ['not-an-ip', false],
  ])('%s is public: %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected)
  })

  it('accepts a normal https address', () => {
    expect(checkAddress('https://canvas.example.edu/feeds/x.ics').hostname).toBe('canvas.example.edu')
  })

  it.each([
    ['http://canvas.example.edu', /https/],
    ['ftp://canvas.example.edu', /https/],
    ['https://me:secret@canvas.example.edu', /password/],
    ['https://127.0.0.1/api', /private/],
    ['https://[::1]/api', /private/],
    ['https://169.254.169.254/latest/meta-data', /private/],
    ['https://localhost:3000', /private/],
    ['https://printer.local', /private/],
    ['not a url', /web address/],
  ])('refuses %s', (address, message) => {
    expect(() => checkAddress(address)).toThrow(message)
  })

  it('refuses private addresses before sending anything', async () => {
    await expect(httpsGet('https://127.0.0.1/')).rejects.toBeInstanceOf(UnsafeAddressError)
    await expect(httpsGet('http://example.com/')).rejects.toBeInstanceOf(UnsafeAddressError)
  })
})

describe('reading a Canvas feed', () => {
  const feed = parseCanvasFeed(FEED)
  const all = [...feed.assignments.values()].flat()
  const byId = Object.fromEntries(all.map((e) => [e.externalId, e]))

  it('lists one course per bracketed course name, using the id from the link', () => {
    expect(feed.courses).toEqual([
      { externalId: 'course_321', name: 'CS 321', kind: 'course' },
      { externalId: 'course_455', name: 'CS 455', kind: 'course' },
      { externalId: 'course_101', name: 'CHEM 101', kind: 'course' },
      { externalId: 'name:First Year Seminar', name: 'First Year Seminar', kind: 'course' },
    ])
  })

  it('turns an assignment into a deadline with its course and link', () => {
    expect(byId.assignment_9001).toEqual({
      externalId: 'assignment_9001',
      title: 'Haskell quiz 6',
      startsAt: new Date('2026-11-14T04:59:00Z'),
      endsAt: new Date('2026-11-14T04:59:00Z'),
      allDay: false,
      kind: 'deadline',
      courseName: 'CS 321',
      sourceUrl: 'https://canvas.example.edu/courses/321/assignments/9001',
    })
  })

  it('keeps a student’s own extended due date as its own deadline', () => {
    expect(byId.assignment_override_77).toMatchObject({
      title: 'Problem set 4 (extended)',
      startsAt: new Date('2026-11-20T04:59:00Z'),
    })
    expect(feed.assignments.get('course_455')?.map((e) => e.externalId)).toContain('assignment_override_77')
  })

  it('keeps an all-day due date on its own day, whatever the server’s time zone', () => {
    expect(byId.assignment_9003).toMatchObject({
      allDay: true,
      startsAt: new Date('2026-11-18T00:00:00Z'),
      endsAt: new Date('2026-11-19T00:00:00Z'),
    })
  })

  it('converts a time written in a named zone to the right moment', () => {
    expect(byId.assignment_9004.startsAt).toEqual(new Date('2026-11-19T22:00:00Z'))
  })

  it('leaves out course events that aren’t assignments', () => {
    expect(all.map((e) => e.title)).not.toContain('Office hours')
    expect(all).toHaveLength(5)
  })

  it('refuses something that isn’t a calendar', () => {
    expect(() => parseCanvasFeed('<html>Log in to Canvas</html>')).toThrow(FeedFormatError)
  })
})

describe('the Canvas API with an access token', () => {
  it('sends the token as a header, never in the address', async () => {
    const canvas = fakeCanvas({ '/api/v1/users/self': json(200, { id: 42, name: 'Maya' }) })
    expect(await fetchSelf(canvas.get, SCHOOL, 'tok-secret')).toEqual({ id: 42, name: 'Maya' })
    expect(canvas.calls[0].headers.authorization).toBe('Bearer tok-secret')
    expect(canvas.calls[0].url).not.toContain('tok-secret')
  })

  it('says a site isn’t Canvas when it doesn’t answer like Canvas', async () => {
    const canvas = fakeCanvas({ '/api/v1/users/self': text(200, '<html>Welcome</html>') })
    expect(await fetchSelf(canvas.get, SCHOOL, 'tok')).toBeNull()
    expect(await fetchSelf(fakeCanvas({}).get, SCHOOL, 'tok')).toBeNull()
  })

  it('follows every page of courses, and skips ones not open yet', async () => {
    const canvas = fakeCanvas({
      '/api/v1/courses': (url) =>
        url.searchParams.get('page') === '2'
          ? json(200, [{ id: 455, name: 'CS 455' }, { id: 999, access_restricted_by_date: true }])
          : json(200, [{ id: 321, name: 'CS 321' }], {
              link: `<${SCHOOL}/api/v1/courses?page=2&per_page=100>; rel="next", <${SCHOOL}/api/v1/courses?page=1>; rel="first"`,
            }),
    })
    expect((await fetchCourses(canvas.get, SCHOOL, 'tok')).map((c) => c.externalId)).toEqual([
      'course_321',
      'course_455',
    ])
  })

  it('never follows a next-page link to another site', async () => {
    const canvas = fakeCanvas({
      '/api/v1/courses': json(200, [{ id: 1, name: 'A' }], { link: '<https://evil.example.com/steal>; rel="next"' }),
    })
    await fetchCourses(canvas.get, SCHOOL, 'tok')
    expect(canvas.calls).toHaveLength(1)
  })

  it('turns assignments into deadlines, using each student’s own due date', async () => {
    const canvas = fakeCanvas({
      '/api/v1/calendar_events': json(200, [
        {
          id: 'assignment_9001',
          title: 'Haskell quiz 6',
          start_at: '2026-11-14T04:59:00Z',
          context_name: 'CS 321',
          assignment: { due_at: '2026-11-16T04:59:00Z', html_url: `${SCHOOL}/courses/321/assignments/9001` },
        },
        { id: 'assignment_9010', title: 'Ungraded, no due date', start_at: null },
      ]),
    })
    const events = await fetchAssignments(canvas.get, SCHOOL, 'tok', cs321, window)
    expect(events).toEqual([
      {
        externalId: 'assignment_9001',
        title: 'Haskell quiz 6',
        startsAt: new Date('2026-11-16T04:59:00Z'),
        endsAt: new Date('2026-11-16T04:59:00Z'),
        allDay: false,
        kind: 'deadline',
        courseName: 'CS 321',
        sourceUrl: `${SCHOOL}/courses/321/assignments/9001`,
      },
    ])
    const asked = new URL(canvas.calls[0].url)
    expect(asked.searchParams.get('context_codes[]')).toBe('course_321')
    expect(asked.searchParams.get('type')).toBe('assignment')
    expect(asked.searchParams.get('start_date')).toBe(window.from.toISOString())
  })

  it('skips a course the student can no longer see', async () => {
    const canvas = fakeCanvas({ '/api/v1/calendar_events': text(403, 'unauthorized') })
    expect(await fetchAssignments(canvas.get, SCHOOL, 'tok', cs321, window)).toEqual([])
  })

  it('asks to reconnect when the token is refused (#214)', async () => {
    const canvas = fakeCanvas({ '/api/v1/courses': json(401, { errors: [{ message: 'Invalid access token.' }] }) })
    const error = await fetchCourses(canvas.get, SCHOOL, 'tok').catch((e) => e)
    expect(error).toBeInstanceOf(ReauthRequiredError)
    expect(error.message).toBe(TOKEN_REJECTED)
  })

  it.each([
    ['a server error', text(503, 'Service Unavailable')],
    ['the rate limit', text(403, '403 Forbidden (Rate Limit Exceeded)')],
    ['a 429', text(429, 'slow down')],
  ])('retries %s instead of asking to reconnect (#214)', async (_, answer) => {
    const canvas = fakeCanvas({ '/api/v1/courses': answer })
    await expect(fetchCourses(canvas.get, SCHOOL, 'tok')).rejects.toBeInstanceOf(ProviderUnavailableError)
  })

  it('treats no answer at all as temporary', async () => {
    const canvas = fakeCanvas({ '/api/v1/courses': new NetworkError('ECONNRESET') })
    await expect(fetchCourses(canvas.get, SCHOOL, 'tok')).rejects.toBeInstanceOf(ProviderUnavailableError)
  })

  it('asks to reconnect if the school’s address starts pointing somewhere private', async () => {
    const canvas = fakeCanvas({ '/api/v1/courses': new UnsafeAddressError('private') })
    await expect(fetchCourses(canvas.get, SCHOOL, 'tok')).rejects.toBeInstanceOf(ReauthRequiredError)
  })
})

describe('the feed link', () => {
  it('asks to reconnect when Canvas no longer knows the link', async () => {
    const error = await fetchFeed(fakeCanvas({}).get, FEED_URL).catch((e) => e)
    expect(error).toBeInstanceOf(ReauthRequiredError)
    expect(error.message).toBe(FEED_REJECTED)
  })

  it('asks to reconnect when the link returns a page that isn’t a feed', async () => {
    const canvas = fakeCanvas({ [new URL(FEED_URL).pathname]: text(200, '<html>Log in</html>') })
    await expect(fetchFeed(canvas.get, FEED_URL)).rejects.toBeInstanceOf(ReauthRequiredError)
  })

  it('downloads the feed once per sync, not once per course', async () => {
    const canvas = fakeCanvas({ [new URL(FEED_URL).pathname]: text(200, FEED) })
    const adapter = createCanvasAdapter(canvas.get)
    const credentials = { feedUrl: FEED_URL }
    const courses = await adapter.listCalendars(credentials)
    for (const course of courses) await adapter.fetchEvents(credentials, course, window)
    expect(canvas.calls).toHaveLength(1)
  })

  it('only returns deadlines inside the window', async () => {
    const canvas = fakeCanvas({ [new URL(FEED_URL).pathname]: text(200, FEED) })
    const adapter = createCanvasAdapter(canvas.get)
    const narrow = { from: new Date('2026-11-15T00:00:00Z'), to: new Date('2026-11-19T00:00:00Z') }
    const events = await adapter.fetchEvents({ feedUrl: FEED_URL }, { externalId: 'course_455', name: 'CS 455', kind: 'course' }, narrow)
    expect(events.map((e) => e.externalId)).toEqual(['assignment_9003'])
  })
})
