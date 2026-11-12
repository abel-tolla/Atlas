import { describe, expect, it, vi } from 'vitest'

// require-user.ts imports current-user.ts, which imports Auth.js. The tests pass their own getUser.
vi.mock('./current-user', () => ({ getCurrentUser: vi.fn() }))

import { requireUser } from './require-user'

const user = { id: 'u1', name: 'Abel', email: 'a@example.com', image: null, timeZone: null }

describe('requireUser', () => {
  it('returns a 401 with no data and no body when nobody is signed in', async () => {
    const result = await requireUser(async () => null)
    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
      expect(await result.response.text()).toBe('')
    }
  })

  it('returns the user when someone is signed in', async () => {
    expect(await requireUser(async () => user)).toEqual({ user })
  })
})
