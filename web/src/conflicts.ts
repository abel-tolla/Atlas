// Overlap detection (#90). Plain functions so the rules are easy to test.

export interface ConflictCandidate {
  id: string
  /** Local ISO time. */
  start: string
  /** Local ISO time, exclusive. */
  end: string
  allDay?: boolean
  hidden?: boolean
  overlapFriendly?: boolean
}

/** One key per pair, whichever order the ids come in. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Which events clash with which. Events that only touch (one ends as the
 * next starts) do not clash. All-day, hidden and overlap-friendly events
 * never clash, and pairs the user marked as fine are skipped.
 *
 * A sweep over events sorted by start, so a busy year stays fast.
 */
export function findConflicts(
  events: ConflictCandidate[],
  acknowledged: ReadonlySet<string> = new Set(),
): Map<string, string[]> {
  const timed = events
    .filter((e) => !e.allDay && !e.hidden && !e.overlapFriendly && e.end > e.start)
    .sort((a, b) => a.start.localeCompare(b.start))

  const conflicts = new Map<string, string[]>()
  const add = (a: string, b: string) => {
    conflicts.set(a, [...(conflicts.get(a) ?? []), b])
  }

  let active: ConflictCandidate[] = []
  for (const event of timed) {
    active = active.filter((other) => other.end > event.start)
    for (const other of active) {
      if (acknowledged.has(pairKey(event.id, other.id))) continue
      add(event.id, other.id)
      add(other.id, event.id)
    }
    active.push(event)
  }
  return conflicts
}
