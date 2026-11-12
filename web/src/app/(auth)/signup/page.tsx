import type { Metadata } from 'next'
import { SignupForm } from '../../../components/auth/SignupForm'
import { SocialButtons } from '../../../components/auth/SocialButtons'
import { redirectIfSignedIn } from '../../../lib/auth/current-user'
import { safeFrom } from '../../../lib/auth/messages'

export const metadata: Metadata = { title: 'Sign up · Atlas' }

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const from = safeFrom((await searchParams).from)
  await redirectIfSignedIn(from)

  return (
    <>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">Bring all your calendars into one place.</p>
      <SocialButtons from={from} />
      <SignupForm from={from} />
    </>
  )
}
