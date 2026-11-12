import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { open, seal } from './secrets'

const key = randomBytes(32).toString('base64')
const otherKey = randomBytes(32).toString('base64')
const token = 'EwBwA8l6BAAU-pretend-microsoft-refresh-token'

describe('seal and open', () => {
  it('round-trips a token', () => {
    expect(open(seal(token, { key }), { key })).toBe(token)
  })

  it('never stores the token itself, and seals it differently every time', () => {
    const a = seal(token, { key })
    const b = seal(token, { key })
    expect(a).not.toContain(token)
    expect(a).not.toBe(b)
    expect(a.startsWith('v1.')).toBe(true)
  })

  it('refuses a value that was changed', () => {
    const sealed = seal(token, { key })
    const [version, iv, tag, body] = sealed.split('.')
    const flipped = body[0] === 'A' ? `B${body.slice(1)}` : `A${body.slice(1)}`
    expect(() => open([version, iv, tag, flipped].join('.'), { key })).toThrow()
  })

  it('refuses the wrong key', () => {
    expect(() => open(seal(token, { key }), { key: otherKey })).toThrow()
  })

  it('refuses a value copied to another account', () => {
    const sealed = seal(token, { key, context: 'account-1' })
    expect(open(sealed, { key, context: 'account-1' })).toBe(token)
    expect(() => open(sealed, { key, context: 'account-2' })).toThrow()
  })

  it('explains a missing or malformed key', () => {
    expect(() => seal(token, { key: '' })).toThrow(/not set/)
    expect(() => seal(token, { key: 'too-short' })).toThrow(/32 bytes/)
    expect(() => open('not-a-sealed-value', { key })).toThrow(/not sealed by Atlas/)
  })
})
