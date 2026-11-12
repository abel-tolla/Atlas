import { describe, expect, it } from 'vitest'
import { findConflicts, pairKey, type ConflictCandidate } from './conflicts'

const ev = (id: string, start: string, end: string, extra: Partial<ConflictCandidate> = {}) => ({
  id,
  start: `2026-11-04T${start}`,
  end: `2026-11-04T${end}`,
  ...extra,
})

const partners = (events: ConflictCandidate[], ack?: Set<string>) =>
  Object.fromEntries(findConflicts(events, ack))

// #90: partly overlapping, fully overlapping and touching events,
// skipping hidden and overlap-friendly ones.
describe('findConflicts', () => {
  it('flags events that partly overlap', () => {
    expect(partners([ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30')])).toEqual({
      a: ['b'],
      b: ['a'],
    })
  })

  it('flags an event that sits fully inside another', () => {
    expect(partners([ev('shift', '14:30', '18:00'), ev('study', '16:00', '17:00')])).toEqual({
      shift: ['study'],
      study: ['shift'],
    })
  })

  it('does not flag events that only touch', () => {
    expect(partners([ev('a', '09:00', '10:00'), ev('b', '10:00', '11:00')])).toEqual({})
  })

  it('skips hidden events', () => {
    expect(
      partners([ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30', { hidden: true })]),
    ).toEqual({})
  })

  it('skips overlap-friendly events', () => {
    expect(
      partners([ev('lecture', '09:00', '10:00'), ev('work', '09:00', '10:00', { overlapFriendly: true })]),
    ).toEqual({})
  })

  it('skips all-day events', () => {
    expect(
      partners([ev('a', '09:00', '10:00'), ev('due', '00:00', '23:59', { allDay: true })]),
    ).toEqual({})
  })

  it('skips pairs the user marked as fine, but only those pairs', () => {
    const events = [ev('a', '09:00', '11:00'), ev('b', '09:30', '10:00'), ev('c', '10:30', '11:30')]
    expect(partners(events, new Set([pairKey('b', 'a')]))).toEqual({ a: ['c'], c: ['a'] })
  })

  it('finds every pair when three events overlap', () => {
    const result = partners([ev('a', '09:00', '12:00'), ev('b', '10:00', '11:00'), ev('c', '10:30', '11:30')])
    expect(result.a.sort()).toEqual(['b', 'c'])
    expect(result.b.sort()).toEqual(['a', 'c'])
    expect(result.c.sort()).toEqual(['a', 'b'])
  })

  it('works across midnight', () => {
    const late = { id: 'late', start: '2026-11-04T23:00', end: '2026-11-05T01:00' }
    const early = { id: 'early', start: '2026-11-05T00:30', end: '2026-11-05T02:00' }
    expect(partners([late, early])).toEqual({ late: ['early'], early: ['late'] })
  })
})
