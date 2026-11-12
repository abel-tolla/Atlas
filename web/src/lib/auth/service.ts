import { and, eq, isNotNull, isNull, notExists, sql } from 'drizzle-orm'
import type { Db } from '../../db'
import { accounts, users, type User } from '../../db/schema'
import { duplicateSignupMail, resetMail, verificationMail, type Mailer } from './email'
import {
  checkPassword,
  dummyHash,
  hashPassword,
  PASSWORD_MAX,
  verifyPassword,
  type PasswordProblem,
} from './password'
import { allow, hit } from './rate-limit'
import { deleteUserSessions } from './sessions'
import { consumeEmailToken, createEmailToken } from './tokens'

// The rules of Login Plan.md, as plain functions. Each takes the database and
// the mailer, so tests run them against PGlite with a fake mailer.

export interface Deps {
  db: Db
  send: Mailer
  now?: Date
}

export type AuthError =
  | PasswordProblem
  | 'invalid_email'
  | 'name_required'
  | 'too_many_attempts'
  | 'invalid_token'

export type Result = { ok: true } | { ok: false; error: AuthError }

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const isEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const byEmail = (email: string) => sql`lower(${users.email}) = ${email}`

export async function findUserByEmail(db: Db, email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(byEmail(normalizeEmail(email)))
  return user
}

/**
 * A sign-up for an email that already has an account never says so on screen.
 * It looks the same as a new sign-up, and the owner gets an email instead.
 */
export async function signUpUser(
  { db, send, now = new Date() }: Deps,
  input: { name: string; email: string; password: string; from?: string; ip?: string },
): Promise<Result> {
  const email = normalizeEmail(input.email)
  const name = input.name.trim()
  if (!isEmail(email)) return { ok: false, error: 'invalid_email' }
  if (!name || name.length > 100) return { ok: false, error: 'name_required' }
  const problem = checkPassword(input.password, email)
  if (problem) return { ok: false, error: problem }
  if (!(await allow(db, [['signup', email], ['signupIp', input.ip ?? 'unknown']], now))) {
    return { ok: false, error: 'too_many_attempts' }
  }

  // Hash before looking, so a new email and a taken one take the same time.
  const passwordHash = await hashPassword(input.password)
  const existing = await findUserByEmail(db, email)

  let userId: string | undefined
  if (!existing) {
    const [created] = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id })
    userId = created?.id
  } else if (!existing.emailVerified && existing.passwordHash) {
    // Nobody has proved this email yet, so the newest sign-up wins. An attacker who
    // signed up first loses the password and can't verify the address anyway.
    await db.update(users).set({ name, passwordHash }).where(eq(users.id, existing.id))
    userId = existing.id
  }

  if (userId) {
    await send(verificationMail(email, await createEmailToken(db, userId, 'verify', now), input.from))
  } else if (await hit(db, 'mail', email, now)) {
    await send(duplicateSignupMail(email))
  }
  return { ok: true }
}

/** Sends a new verification link. Says nothing about whether it did. */
export async function resendVerification(
  { db, send, now = new Date() }: Deps,
  input: { email: string; from?: string; ip?: string },
): Promise<void> {
  const email = normalizeEmail(input.email)
  if (!isEmail(email)) return
  if (!(await allow(db, [['mail', email], ['mailIp', input.ip ?? 'unknown']], now))) return
  const user = await findUserByEmail(db, email)
  if (user && !user.emailVerified && user.passwordHash) {
    await send(verificationMail(email, await createEmailToken(db, user.id, 'verify', now), input.from))
  }
}

/** Uses a verification link. Returns the user, who is now verified, or null for a bad link. */
export async function verifyEmailToken(
  { db, now = new Date() }: Pick<Deps, 'db' | 'now'>,
  token: string,
): Promise<User | null> {
  const userId = await consumeEmailToken(db, token, 'verify', now)
  if (!userId) return null
  const [user] = await db
    .update(users)
    .set({ emailVerified: now })
    .where(eq(users.id, userId))
    .returning()
  return user ?? null
}

/** Sends a reset link to a verified account. Says nothing about whether it did. */
export async function requestPasswordReset(
  { db, send, now = new Date() }: Deps,
  input: { email: string; ip?: string },
): Promise<void> {
  const email = normalizeEmail(input.email)
  if (!isEmail(email)) return
  if (!(await allow(db, [['mail', email], ['mailIp', input.ip ?? 'unknown']], now))) return
  const user = await findUserByEmail(db, email)
  if (user?.emailVerified) {
    await send(resetMail(email, await createEmailToken(db, user.id, 'reset', now)))
  }
}

/** Sets a new password and signs the user out everywhere. A weak password doesn't use up the link. */
export async function resetPassword(
  { db, now = new Date() }: Pick<Deps, 'db' | 'now'>,
  input: { token: string; password: string },
): Promise<Result> {
  const problem = checkPassword(input.password)
  if (problem) return { ok: false, error: problem }
  const passwordHash = await hashPassword(input.password)
  const userId = await consumeEmailToken(db, input.token, 'reset', now)
  if (!userId) return { ok: false, error: 'invalid_token' }
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
  await deleteUserSessions(db, userId)
  return { ok: true }
}

export type CredentialsResult =
  | { status: 'ok'; user: User }
  | { status: 'invalid' | 'unverified' | 'limited' }

/** The Credentials sign-in check. Every attempt counts toward the limit, right or wrong. */
export async function checkCredentials(
  { db, now = new Date() }: Pick<Deps, 'db' | 'now'>,
  input: { email: string; password: string; ip?: string },
): Promise<CredentialsResult> {
  const email = normalizeEmail(input.email)
  if (!(await allow(db, [['login', email], ['loginIp', input.ip ?? 'unknown']], now))) {
    return { status: 'limited' }
  }
  if (input.password.length > PASSWORD_MAX) return { status: 'invalid' }
  const user = isEmail(email) ? await findUserByEmail(db, email) : undefined
  // Compare against a dummy hash when there is no user, so the time doesn't tell.
  const matches = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()))
  if (!user?.passwordHash || !matches) return { status: 'invalid' }
  if (!user.emailVerified) return { status: 'unverified' }
  return { status: 'ok', user }
}

/**
 * Run when someone signs in with Google or Microsoft. A password sign-up with the
 * same email that nobody has verified would block them (OAuthAccountNotLinked),
 * so it is removed. Returns true when it removed one.
 */
export async function dropUnverifiedClaim(db: Db, email: string): Promise<boolean> {
  const gone = await db
    .delete(users)
    .where(
      and(
        byEmail(normalizeEmail(email)),
        isNull(users.emailVerified),
        isNotNull(users.passwordHash),
        notExists(db.select({ one: sql`1` }).from(accounts).where(eq(accounts.userId, users.id))),
      ),
    )
    .returning({ id: users.id })
  return gone.length > 0
}

/** Saves the browser's time zone once (F-37). Ignores names the runtime doesn't know. */
export async function saveTimeZone(db: Db, userId: string, timeZone: string): Promise<void> {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    return
  }
  await db
    .update(users)
    .set({ timeZone })
    .where(and(eq(users.id, userId), isNull(users.timeZone)))
}
