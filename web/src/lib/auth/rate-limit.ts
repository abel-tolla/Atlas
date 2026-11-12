import { lt, sql } from 'drizzle-orm'
import type { Db } from '../../db'
import { rateLimits } from '../../db/schema'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** Counters live in Neon because Vercel functions share no memory. */
export const LIMITS = {
  login: { limit: 5, windowMs: 15 * MINUTE },
  loginIp: { limit: 20, windowMs: 15 * MINUTE },
  signup: { limit: 5, windowMs: HOUR },
  signupIp: { limit: 20, windowMs: HOUR },
  mail: { limit: 3, windowMs: HOUR },
  mailIp: { limit: 20, windowMs: HOUR },
} as const

export type LimitName = keyof typeof LIMITS

/**
 * Counts one try and says whether it is still allowed.
 * shortcut: fixed windows, so a burst up to twice the limit fits around a window edge; move to a sliding window if abuse shows up.
 */
export async function hit(db: Db, name: LimitName, id: string, now = new Date()): Promise<boolean> {
  const { limit, windowMs } = LIMITS[name]
  const window = Math.floor(now.getTime() / windowMs)
  const key = `${name}:${id.toLowerCase()}:${window}`
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt: new Date((window + 1) * windowMs) })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count })
  // A new window is a cheap moment to drop old counters.
  if (row.count === 1) await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now))
  return row.count <= limit
}

/** Counts every check (no early exit) and allows the try only if all of them pass. */
export async function allow(db: Db, checks: [LimitName, string][], now = new Date()) {
  const results = await Promise.all(checks.map(([name, id]) => hit(db, name, id, now)))
  return results.every(Boolean)
}
