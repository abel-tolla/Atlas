import type { ReactNode } from 'react'
import { AtlasLogo } from '../../components/AtlasLogo'

// The logged-out pages: login, sign-up, verify, forgot and reset password.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card card">
        <AtlasLogo />
        {children}
      </div>
    </main>
  )
}
