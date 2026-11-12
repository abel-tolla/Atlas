'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { signUp, type FormState } from '../../lib/auth/actions'
import { messageFor } from '../../lib/auth/messages'
import { PASSWORD_MIN } from '../../lib/auth/rules'
import { PasswordField } from './PasswordField'

const initial: FormState = {}

export function SignupForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState(signUp, initial)
  const [password, setPassword] = useState('')
  const message = state.error ? messageFor(state.error, state.error) : null
  const query = from === '/' ? '' : `?from=${encodeURIComponent(from)}`

  return (
    <form action={action} className="auth-form">
      {message && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}
      <input type="hidden" name="from" value={from} />
      <label className="field">
        Name
        <input name="name" autoComplete="name" autoFocus required maxLength={100} defaultValue={state.name} />
      </label>
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </label>
      <PasswordField name="password" label="Password" autoComplete="new-password" onChange={setPassword} />
      <p className="hint" data-ok={password.length >= PASSWORD_MIN}>
        {password.length >= PASSWORD_MIN
          ? 'Long enough.'
          : `Use at least ${PASSWORD_MIN} characters. A few random words work well.`}
      </p>
      <button className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <p className="auth-foot">
        Already have an account?{' '}
        <Link href={`/login${query}`} className="link">
          Log in
        </Link>
      </p>
    </form>
  )
}
