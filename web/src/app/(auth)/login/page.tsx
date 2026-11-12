import type { Metadata } from 'next'
import { CleanUrl } from '../../../components/auth/CleanUrl'
import { LoginForm } from '../../../components/auth/LoginForm'
import { SocialButtons } from '../../../components/auth/SocialButtons'
import { redirectIfSignedIn } from '../../../lib/auth/current-user'
import { safeFrom } from '../../../lib/auth/messages'

export const metadata: Metadata = { title: 'Log in · Atlas' }

type Search = { from?: string; error?: string; code?: string; reset?: string }

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { from: rawFrom, error, code, reset } = await searchParams
  const from = safeFrom(rawFrom)
  await redirectIfSignedIn(from)
  // Auth.js sends `error` (and `code` for password logins). Only the code reaches the form.
  const initialError = error === 'CredentialsSignin' ? (code ?? error) : error

  return (
    <>
      <h1 className="auth-title">Log in to Atlas</h1>
      <p className="auth-sub">Every calendar. One place.</p>
      {reset && (
        <p className="notice" role="status">
          Password changed. Log in with your new password.
        </p>
      )}
      <SocialButtons from={from} />
      <LoginForm from={from} initialError={initialError} />
      <CleanUrl params={['error', 'code', 'reset']} />
    </>
  )
}
