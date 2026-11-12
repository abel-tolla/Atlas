import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Db } from '../../db'
import { emailTokens } from '../../db/schema'

export type TokenPurpose = 'verify' | 'reset'

const HOUR = 60 * 60 * 1000
export const TOKEN_TTL: Record<TokenPurpose, number> = { verify: 24 * HOUR, reset: HOUR }

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/** Returns the token to put in the email. Only its hash is stored, and older links of the same kind stop working. */
export async function createEmailToken(
  db: Db,
  userId: string,
  purpose: TokenPurpose,
  now = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose)))
  await db.insert(emailTokens).values({
    userId,
    purpose,
    tokenHash: hash(token),
    expiresAt: new Date(now.getTime() + TOKEN_TTL[purpose]),
  })
  return token
}

const usable = (token: string, purpose: TokenPurpose, now: Date) =>
  and(
    eq(emailTokens.tokenHash, hash(token)),
    eq(emailTokens.purpose, purpose),
    isNull(emailTokens.usedAt),
    gt(emailTokens.expiresAt, now),
  )

/** Looks at a link without using it, so a page can say "expired" early. */
export async function peekEmailToken(
  db: Db,
  token: string,
  purpose: TokenPurpose,
  now = new Date(),
): Promise<boolean> {
  const rows = await db
    .select({ id: emailTokens.id })
    .from(emailTokens)
    .where(usable(token, purpose, now))
  return rows.length > 0
}

/** Uses a link once. One UPDATE decides, so two clicks at the same moment can't both win. */
export async function consumeEmailToken(
  db: Db,
  token: string,
  purpose: TokenPurpose,
  now = new Date(),
): Promise<string | null> {
  const rows = await db
    .update(emailTokens)
    .set({ usedAt: now })
    .where(usable(token, purpose, now))
    .returning({ userId: emailTokens.userId })
  return rows[0]?.userId ?? null
}
