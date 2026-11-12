import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from './proxy'

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined)

describe('proxy (first pass only, the layout does the real check)', () => {
  it('sends a logged-out visitor to login and remembers the page they asked for', () => {
    const res = proxy(request('/calendar?view=week'))
    expect(res.status).toBe(307)
    const url = new URL(res.headers.get('location')!)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('from')).toBe('/calendar?view=week')
  })

  it('sends a logged-out visitor to plain /login from Today', () => {
    expect(res(proxy(request('/')))).toBe('http://localhost:3000/login')
  })

  it('answers a logged-out API call with an empty 401, not a redirect', async () => {
    const response = proxy(request('/api/events'))
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('')
  })

  it('lets logged-out visitors reach the sign-in pages and Auth.js routes', () => {
    for (const path of [
      '/login',
      '/signup',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/api/auth/session',
      '/api/auth/callback/google',
    ]) {
      expect(proxy(request(path)).headers.get('location'), path).toBeNull()
      expect(proxy(request(path)).status, path).toBe(200)
    }
  })

  it('lets a visitor with a session cookie through, in dev and in production', () => {
    expect(proxy(request('/calendar', 'authjs.session-token=abc')).status).toBe(200)
    expect(proxy(request('/calendar', '__Secure-authjs.session-token=abc')).status).toBe(200)
    // A long session is split in chunks.
    expect(proxy(request('/calendar', '__Secure-authjs.session-token.0=abc')).status).toBe(200)
  })

  it('does not treat a lookalike path as a sign-in page', () => {
    expect(proxy(request('/login-admin')).status).toBe(307)
    expect(proxy(request('/api/authx')).status).toBe(401)
  })
})

const res = (r: Response) => r.headers.get('location')
