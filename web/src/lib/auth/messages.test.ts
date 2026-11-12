import { describe, expect, it } from 'vitest'
import { messageFor, safeFrom } from './messages'

describe('messageFor', () => {
  it('maps each Auth.js error to its message', () => {
    expect(messageFor('AccessDenied')).toBe('You cancelled sign-in. Nothing was saved.')
    expect(messageFor('OAuthAccountNotLinked')).toMatch(/already uses another sign-in/)
    for (const e of ['OAuthCallbackError', 'OAuthSignin', 'Callback']) {
      expect(messageFor(e)).toMatch(/didn’t answer as expected/)
    }
  })

  it('maps password login codes', () => {
    expect(messageFor('CredentialsSignin', 'credentials')).toBe('Incorrect email or password.')
    expect(messageFor('CredentialsSignin', 'email_not_verified')).toMatch(/verify your email/)
    expect(messageFor('CredentialsSignin', 'too_many_attempts')).toMatch(/Too many tries/)
    // An unknown reason must not leak: it reads like a wrong password.
    expect(messageFor('CredentialsSignin', 'something_else')).toBe('Incorrect email or password.')
  })

  it('uses the fallback for Configuration and anything unknown', () => {
    expect(messageFor('Configuration')).toMatch(/isn’t working right now/)
    expect(messageFor('Whatever')).toMatch(/isn’t working right now/)
  })

  it('returns null when there is no error', () => {
    expect(messageFor(undefined)).toBeNull()
    expect(messageFor(null, null)).toBeNull()
  })
})

describe('safeFrom', () => {
  it('keeps paths inside Atlas', () => {
    expect(safeFrom('/calendar')).toBe('/calendar')
    expect(safeFrom('/calendar?view=week')).toBe('/calendar?view=week')
  })

  it('refuses addresses that leave Atlas', () => {
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '', '/a\nb']) {
      expect(safeFrom(bad)).toBe('/')
    }
  })

  it('goes to Today when there is no usable value', () => {
    expect(safeFrom(undefined)).toBe('/')
    expect(safeFrom(['/a'])).toBe('/')
  })
})
