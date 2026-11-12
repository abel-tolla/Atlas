import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../../db'
import { createTestDb } from '../../test/db'
import { allow, hit, LIMITS } from './rate-limit'

let db: Db
const t0 = new Date('2026-01-01T12:00:00Z')

beforeAll(async () => {
  db = await createTestDb()
})

describe('rate limits', () => {
  it('allows the limit, then blocks', async () => {
    for (let i = 0; i < LIMITS.login.limit; i++) expect(await hit(db, 'login', 'a@x.com', t0)).toBe(true)
    expect(await hit(db, 'login', 'a@x.com', t0)).toBe(false)
  })

  it('counts each address on its own, ignoring case', async () => {
    expect(await hit(db, 'login', 'other@x.com', t0)).toBe(true)
    for (let i = 0; i < LIMITS.login.limit; i++) await hit(db, 'login', 'Case@x.com', t0)
    expect(await hit(db, 'login', 'case@X.com', t0)).toBe(false)
  })

  it('starts again in the next window', async () => {
    const later = new Date(t0.getTime() + LIMITS.login.windowMs)
    expect(await hit(db, 'login', 'a@x.com', later)).toBe(true)
  })

  it('allow() blocks when any one check fails, and counts them all', async () => {
    for (let i = 0; i < LIMITS.mail.limit; i++) await hit(db, 'mail', 'm@x.com', t0)
    expect(await allow(db, [['mail', 'm@x.com'], ['mailIp', '1.2.3.4']], t0)).toBe(false)
    // The IP check still counted, so one noisy address can't hide behind the other check.
    expect(await hit(db, 'mailIp', '1.2.3.4', t0)).toBe(true)
  })
})
