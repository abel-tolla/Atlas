import type { ReactNode } from 'react'
import { AppShell } from '../../components/AppShell'

// Every signed-in page lives in this group. The Login epic adds the
// session check here (#52).
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
