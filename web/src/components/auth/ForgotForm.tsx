'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, type FormState } from '../../lib/auth/actions'

const initial: FormState = {}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial)

  if (state.notice) {
    return (
      <div className="auth-form">
        <p className="notice" role="status">
          If that address has an account, we sent a link to reset the password. It works for 1 hour.
        </p>
        <Link href="/login" className="btn btn--block">
          Back to log in
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="auth-form">
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" autoFocus required defaultValue={state.email} />
      </label>
      <button className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="auth-foot">
        <Link href="/login" className="link">
          Back to log in
        </Link>
      </p>
    </form>
  )
}
