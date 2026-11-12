import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetForm } from '../../../components/auth/ResetForm'
import { getDb } from '../../../db'
import { messageFor } from '../../../lib/auth/messages'
import { peekEmailToken } from '../../../lib/auth/tokens'

export const metadata: Metadata = { title: 'Reset password · Atlas' }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  // Only looks at the link. It is used up when the new password is saved.
  const valid = token ? await peekEmailToken(getDb(), token, 'reset') : false

  if (!token || !valid) {
    return (
      <>
        <h1 className="auth-title">This link has expired</h1>
        <p className="alert" role="alert">
          {messageFor('invalid_token')}
        </p>
        <div className="auth-form">
          <Link href="/forgot-password" className="btn btn--primary btn--block">
            Send a new link
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="auth-title">Choose a new password</h1>
      <p className="auth-sub">You’ll be signed out everywhere else.</p>
      <ResetForm token={token} />
    </>
  )
}
