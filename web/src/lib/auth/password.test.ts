import { describe, expect, it } from 'vitest'
import { checkPassword, hashPassword, verifyPassword } from './password'

describe('checkPassword', () => {
  it('needs 8 to 128 characters and nothing else', () => {
    expect(checkPassword('short')).toBe('too_short')
    expect(checkPassword('a'.repeat(129))).toBe('too_long')
    expect(checkPassword('a'.repeat(128))).toBeNull()
    expect(checkPassword('correct horse battery')).toBeNull()
  })

  it('refuses common passwords in any case, and the email itself', () => {
    expect(checkPassword('Password123')).toBe('common')
    expect(checkPassword('QWERTYUIOP')).toBe('common')
    expect(checkPassword('abel@example.com', 'abel@example.com')).toBe('common')
  })
})

describe('hashPassword and verifyPassword', () => {
  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash).toMatch(/^scrypt\$65536\$8\$1\$/)
    expect(await verifyPassword('correct horse battery', hash)).toBe(true)
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false)
  })

  it('salts each hash and never stores the password', async () => {
    const [a, b] = await Promise.all([hashPassword('same password!'), hashPassword('same password!')])
    expect(a).not.toBe(b)
    expect(a).not.toContain('same password!')
  })

  it('refuses a malformed stored value instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
  })
})
