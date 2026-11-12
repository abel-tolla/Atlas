import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../db'
import { accounts, users } from '../../db/schema'
import { createInbox, createTestDb } from '../../test/db'
import { createSession, checkSession } from './sessions'
import {
  checkCredentials,
  dropUnverifiedClaim,
  findUserByEmail,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  saveTimeZone,
  signUpUser,
  verifyEmailToken,
} from './service'

let db: Db
let inbox: ReturnType<typeof createInbox>
const t0 = new Date('2026-01-01T12:00:00Z')
const PASSWORD = 'correct horse battery'
const EMAIL = 'abel@example.com'

const deps = () => ({ db, send: inbox.send, now: t0 })
const signUp = (over: Partial<Parameters<typeof signUpUser>[1]> = {}) =>
  signUpUser(deps(), { name: 'Abel', email: EMAIL, password: PASSWORD, ...over })
const signUpAndVerify = async () => {
  await signUp()
  return (await verifyEmailToken(deps(), inbox.tokenFor(EMAIL)))!
}

beforeEach(async () => {
  db = await createTestDb()
  inbox = createInbox()
})

describe('sign up and verify', () => {
  it('creates an unverified account, emails a link, and keeps no plain password', async () => {
    expect(await signUp()).toEqual({ ok: true })
    const user = (await findUserByEmail(db, EMAIL))!
    expect(user.emailVerified).toBeNull()
    expect(user.passwordHash).toMatch(/^scrypt\$/)
    expect(user.passwordHash).not.toContain(PASSWORD)
    expect(inbox.sent).toHaveLength(1)
    expect(inbox.sent[0].subject).toMatch(/Verify your email/)
  })

  it('keeps an unverified account out until the link is used', async () => {
    await signUp()
    expect((await checkCredentials(deps(), { email: EMAIL, password: PASSWORD })).status).toBe('unverified')
    const user = await verifyEmailToken(deps(), inbox.tokenFor(EMAIL))
    expect(user?.emailVerified).toEqual(t0)
    expect((await checkCredentials(deps(), { email: EMAIL, password: PASSWORD })).status).toBe('ok')
  })

  it('refuses a link that was already used or never existed', async () => {
    await signUp()
    const token = inbox.tokenFor(EMAIL)
    expect(await verifyEmailToken(deps(), token)).not.toBeNull()
    expect(await verifyEmailToken(deps(), token)).toBeNull()
    expect(await verifyEmailToken(deps(), 'made-up')).toBeNull()
  })

  it('keeps the page the visitor wanted inside the link', async () => {
    await signUp({ from: '/calendar' })
    expect(inbox.sent[0].text).toContain('from=%2Fcalendar')
    await signUp({ from: '//evil.com' })
    expect(inbox.sent[1].text).not.toContain('evil.com')
  })

  it('checks the form', async () => {
    expect(await signUp({ email: 'nope' })).toEqual({ ok: false, error: 'invalid_email' })
    expect(await signUp({ name: '  ' })).toEqual({ ok: false, error: 'name_required' })
    expect(await signUp({ password: 'short' })).toEqual({ ok: false, error: 'too_short' })
    expect(await signUp({ password: 'password123' })).toEqual({ ok: false, error: 'common' })
    expect(inbox.sent).toHaveLength(0)
  })

  it('blocks the sixth sign-up for one address in an hour', async () => {
    for (let i = 0; i < 5; i++) expect((await signUp()).ok).toBe(true)
    expect(await signUp()).toEqual({ ok: false, error: 'too_many_attempts' })
  })

  it('treats the email as the same whatever its case', async () => {
    await signUp({ email: '  Abel@Example.COM ' })
    expect(await findUserByEmail(db, EMAIL)).toBeDefined()
    expect(inbox.sent[0].to).toBe(EMAIL)
  })
})

describe('sign up with an email that already has an account', () => {
  it('looks the same on screen, makes no second account, and warns the owner', async () => {
    const owner = await signUpAndVerify()
    inbox.sent.length = 0

    expect(await signUp({ name: 'Mallory', password: 'a different password' })).toEqual({ ok: true })

    expect(await db.select().from(users)).toHaveLength(1)
    expect(inbox.sent).toHaveLength(1)
    expect(inbox.sent[0].subject).toMatch(/Someone tried to sign up/)
    expect(inbox.sent[0].text).not.toMatch(/token=/)
    // The owner's password and name are untouched.
    expect((await findUserByEmail(db, EMAIL))!.passwordHash).toBe(owner.passwordHash)
    expect((await findUserByEmail(db, EMAIL))!.name).toBe('Abel')
  })

  it('lets the newest sign-up win while nobody has verified the address', async () => {
    await signUp({ name: 'Mallory', password: 'mallory password' })
    await signUp()
    const user = (await verifyEmailToken(deps(), inbox.tokenFor(EMAIL)))!
    expect(user.name).toBe('Abel')
    expect((await checkCredentials(deps(), { email: EMAIL, password: 'mallory password' })).status).toBe('invalid')
    expect((await checkCredentials(deps(), { email: EMAIL, password: PASSWORD })).status).toBe('ok')
  })

  it('stops the first link once a newer sign-up replaced it', async () => {
    await signUp({ name: 'Mallory', password: 'mallory password' })
    const mallorysToken = inbox.tokenFor(EMAIL)
    await signUp()
    expect(await verifyEmailToken(deps(), mallorysToken)).toBeNull()
  })
})

describe('password login', () => {
  it('gives wrong passwords and unknown emails the same answer', async () => {
    await signUpAndVerify()
    expect((await checkCredentials(deps(), { email: EMAIL, password: 'wrong password' })).status).toBe('invalid')
    expect((await checkCredentials(deps(), { email: 'who@example.com', password: PASSWORD })).status).toBe('invalid')
    expect((await checkCredentials(deps(), { email: 'not an email', password: PASSWORD })).status).toBe('invalid')
  })

  it('blocks the sixth try in 15 minutes, even with the right password', async () => {
    await signUpAndVerify()
    for (let i = 0; i < 5; i++) {
      expect((await checkCredentials(deps(), { email: EMAIL, password: 'wrong password' })).status).toBe('invalid')
    }
    expect((await checkCredentials(deps(), { email: EMAIL, password: PASSWORD })).status).toBe('limited')
    const later = { db, now: new Date(t0.getTime() + 15 * 60 * 1000) }
    expect((await checkCredentials(later, { email: EMAIL, password: PASSWORD })).status).toBe('ok')
  })

  it('has no password login for someone who only uses Google', async () => {
    await db.insert(users).values({ email: 'g@example.com', emailVerified: t0 })
    expect((await checkCredentials(deps(), { email: 'g@example.com', password: PASSWORD })).status).toBe('invalid')
  })
})

describe('resend verification', () => {
  it('sends a new link only to an unverified account, and says nothing either way', async () => {
    await signUp()
    inbox.sent.length = 0
    await resendVerification(deps(), { email: EMAIL })
    await resendVerification(deps(), { email: 'who@example.com' })
    expect(inbox.sent.map((m) => m.to)).toEqual([EMAIL])

    await verifyEmailToken(deps(), inbox.tokenFor(EMAIL))
    inbox.sent.length = 0
    await resendVerification(deps(), { email: EMAIL })
    expect(inbox.sent).toHaveLength(0)
  })

  it('sends at most 3 an hour', async () => {
    await signUp()
    inbox.sent.length = 0
    for (let i = 0; i < 6; i++) await resendVerification(deps(), { email: EMAIL })
    expect(inbox.sent).toHaveLength(3)
  })
})

describe('forgot and reset password', () => {
  it('emails a link only to a verified account', async () => {
    await signUpAndVerify()
    await signUp({ email: 'unverified@example.com' })
    inbox.sent.length = 0

    await requestPasswordReset(deps(), { email: EMAIL })
    await requestPasswordReset(deps(), { email: 'unverified@example.com' })
    await requestPasswordReset(deps(), { email: 'who@example.com' })
    expect(inbox.sent.map((m) => m.to)).toEqual([EMAIL])
  })

  it('sets the new password, ends every session, and works once', async () => {
    const user = await signUpAndVerify()
    const sessionId = await createSession(db, user.id, {}, t0)
    await requestPasswordReset(deps(), { email: EMAIL })
    const token = inbox.tokenFor(EMAIL)

    expect(await resetPassword(deps(), { token, password: 'a brand new password' })).toEqual({ ok: true })

    expect(await checkSession(db, sessionId, t0)).toBe(false)
    expect((await checkCredentials(deps(), { email: EMAIL, password: PASSWORD })).status).toBe('invalid')
    expect((await checkCredentials(deps(), { email: EMAIL, password: 'a brand new password' })).status).toBe('ok')
    expect(await resetPassword(deps(), { token, password: 'yet another password' })).toEqual({
      ok: false,
      error: 'invalid_token',
    })
  })

  it('keeps the link alive when the new password is too weak', async () => {
    await signUpAndVerify()
    await requestPasswordReset(deps(), { email: EMAIL })
    const token = inbox.tokenFor(EMAIL)
    expect(await resetPassword(deps(), { token, password: 'short' })).toEqual({ ok: false, error: 'too_short' })
    expect(await resetPassword(deps(), { token, password: 'a brand new password' })).toEqual({ ok: true })
  })

  it('expires after an hour', async () => {
    await signUpAndVerify()
    await requestPasswordReset(deps(), { email: EMAIL })
    const late = { db, now: new Date(t0.getTime() + 60 * 60 * 1000 + 1) }
    expect(await resetPassword(late, { token: inbox.tokenFor(EMAIL), password: 'a brand new password' })).toEqual({
      ok: false,
      error: 'invalid_token',
    })
  })
})

describe('dropUnverifiedClaim (pre-hijack guard)', () => {
  it('removes an unverified password sign-up so the real owner can use Google', async () => {
    await signUp()
    expect(await dropUnverifiedClaim(db, 'Abel@Example.com')).toBe(true)
    expect(await findUserByEmail(db, EMAIL)).toBeUndefined()
  })

  it('leaves a verified account alone', async () => {
    await signUpAndVerify()
    expect(await dropUnverifiedClaim(db, EMAIL)).toBe(false)
    expect(await findUserByEmail(db, EMAIL)).toBeDefined()
  })

  it('leaves an account that already has a Google or Microsoft identity alone', async () => {
    await signUp()
    const user = (await findUserByEmail(db, EMAIL))!
    await db.insert(accounts).values({
      userId: user.id,
      type: 'oidc',
      provider: 'google',
      providerAccountId: '1',
    })
    expect(await dropUnverifiedClaim(db, EMAIL)).toBe(false)
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1)
  })
})

describe('saveTimeZone', () => {
  it('saves the first valid zone only', async () => {
    const user = await signUpAndVerify()
    await saveTimeZone(db, user.id, 'Not/AZone')
    expect((await findUserByEmail(db, EMAIL))!.timeZone).toBeNull()
    await saveTimeZone(db, user.id, 'America/Chicago')
    await saveTimeZone(db, user.id, 'Europe/Paris')
    expect((await findUserByEmail(db, EMAIL))!.timeZone).toBe('America/Chicago')
  })
})
