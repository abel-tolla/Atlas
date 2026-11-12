import { and, eq, ne } from 'drizzle-orm'
import type { Db } from '../../db'
import { authSessions } from '../../db/schema'

export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/**
 * The server-side half of a session (Login Plan.md, "Server-side sessions").
 * The signed cookie names a row here. No row, no session, so log out works at once (#210).
 */
export async function createSession(
  db: Db,
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID()
  await db.insert(authSessions).values({
    id,
    userId,
    expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS),
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
  })
  return id
}

/** True while the row exists and has not expired. Slides the expiry forward at most once a day. */
export async function checkSession(db: Db, id: string, now = new Date()): Promise<boolean> {
  const [row] = await db.select().from(authSessions).where(eq(authSessions.id, id))
  if (!row) return false
  if (row.expiresAt <= now) {
    await deleteSession(db, id)
    return false
  }
  if (row.expiresAt.getTime() - now.getTime() < SESSION_MAX_AGE_MS - DAY) {
    await db
      .update(authSessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS) })
      .where(eq(authSessions.id, id))
  }
  return true
}

export async function deleteSession(db: Db, id: string) {
  await db.delete(authSessions).where(eq(authSessions.id, id))
}

/** Signs a user out everywhere, optionally keeping one browser. */
export async function deleteUserSessions(db: Db, userId: string, exceptId?: string) {
  await db
    .delete(authSessions)
    .where(
      exceptId
        ? and(eq(authSessions.userId, userId), ne(authSessions.id, exceptId))
        : eq(authSessions.userId, userId),
    )
}
