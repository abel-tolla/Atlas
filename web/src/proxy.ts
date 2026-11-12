import { NextResponse, type NextRequest } from 'next/server'

// A fast first pass only (#52). It looks for a session cookie, not a valid session.
// The real check is in app/(app)/layout.tsx and in requireUser(), because
// proxy checks have been bypassed in Next.js before.

const OPEN_PAGES = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password']
const COOKIE = 'authjs.session-token'

const isOpen = (path: string) =>
  path.startsWith('/api/auth/') || OPEN_PAGES.some((p) => path === p || path.startsWith(`${p}/`))

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const headers = new Headers(request.headers)
  // The layout reads this to send a visitor with a dead cookie back to the right page.
  headers.set('x-atlas-path', pathname + search)

  const hasCookie = request.cookies
    .getAll()
    .some(({ name }) => name.replace('__Secure-', '').startsWith(COOKIE))

  if (!hasCookie && !isOpen(pathname)) {
    if (pathname.startsWith('/api/')) return new NextResponse(null, { status: 401 })
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('from', pathname + search)
    return NextResponse.redirect(login)
  }
  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Everything except Next.js internals and the public brand files.
  matcher: ['/((?!_next/static|_next/image|brand/|favicon\\.ico).*)'],
}
