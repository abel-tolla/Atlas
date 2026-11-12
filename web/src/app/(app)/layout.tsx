import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '../../components/AppShell'
import { getCurrentUser } from '../../lib/auth/current-user'
import { safeFrom } from '../../lib/auth/messages'

// Every signed-in page lives in this group, so this one check covers them all (#52).
// proxy.ts only looks for a cookie. This one checks the session against Neon.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    // proxy.ts leaves the page the visitor asked for in this header.
    const from = safeFrom((await headers()).get('x-atlas-path'))
    redirect(from === '/' ? '/login' : `/login?from=${encodeURIComponent(from)}`)
  }
  return <AppShell user={user}>{children}</AppShell>
}
