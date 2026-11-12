import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { CleanUrl } from '../../../components/auth/CleanUrl'
import { ResendButton } from '../../../components/auth/ResendButton'
import { verifyEmail } from '../../../lib/auth/actions'
import { messageFor, safeFrom } from '../../../lib/auth/messages'

export const metadata: Metadata = { title: 'Verify your email · Atlas' }

type Search = { token?: string; from?: string; error?: string }

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { token, from: rawFrom, error } = await searchParams
  const from = safeFrom(rawFrom)

  // The link from the email. It needs a click, so an email scanner that opens the
  // link can't use it up before the person does.
  if (token) {
    return (
      <>
        <h1 className="auth-title">Confirm your email</h1>
        <p className="auth-sub">One more step to finish signing up.</p>
        <form action={verifyEmail} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="from" value={from} />
          <button className="btn btn--primary btn--block">Verify my email</button>
        </form>
      </>
    )
  }

  const email = (await cookies()).get('atlas-pending-email')?.value

  return (
    <>
      <h1 className="auth-title">{error ? 'This link has expired' : 'Check your inbox'}</h1>
      {error ? (
        <p className="alert" role="alert">
          {messageFor(error, error)}
        </p>
      ) : (
        <p className="auth-sub">
          {email ? (
            <>
              We sent a link to <strong>{email}</strong>. Click it to finish signing up.
            </>
          ) : (
            'We sent you a link. Click it to finish signing up.'
          )}
        </p>
      )}
      <div className="auth-form">
        <ResendButton from={from} startWaiting={!error && !!email} />
        {!email && (
          <p className="hint">
            Not sure which address you used? <Link href="/signup" className="link">Sign up again</Link>.
          </p>
        )}
        <p className="auth-foot">
          <Link href="/login" className="link">
            Back to log in
          </Link>
        </p>
      </div>
      <CleanUrl params={['error']} />
    </>
  )
}
