import type { Metadata } from 'next'
import { ForgotForm } from '../../../components/auth/ForgotForm'
import { redirectIfSignedIn } from '../../../lib/auth/current-user'

export const metadata: Metadata = { title: 'Forgot password · Atlas' }

export default async function ForgotPasswordPage() {
  await redirectIfSignedIn()
  return (
    <>
      <h1 className="auth-title">Forgot your password?</h1>
      <p className="auth-sub">Enter your email and we’ll send you a link to choose a new one.</p>
      <ForgotForm />
    </>
  )
}
