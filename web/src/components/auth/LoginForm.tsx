'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { logIn, type FormState } from '../../lib/auth/actions'
import { messageFor } from '../../lib/auth/messages'
import { PasswordField } from './PasswordField'
import { ResendButton } from './ResendButton'

const initial: FormState = {}

export function LoginForm({ from, initialError }: { from: string; initialError?: string }) {
  const [state, action, pending] = useActionState(logIn, initial)
  const error = state.error ?? initialError
  const message = error ? messageFor(error, error) : null
  const query = from === '/' ? '' : `?from=${encodeURIComponent(from)}`

  return (
    <form action={action} className="auth-form">
      {message && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}
      {error === 'email_not_verified' && state.email && (
        <ResendButton email={state.email} from={from} label="Send it again" />
      )}
      <input type="hidden" name="from" value={from} />
      <label className="field">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          defaultValue={state.email}
        />
      </label>
      <PasswordField name="password" label="Password" autoComplete="current-password" />
      <Link href="/forgot-password" className="link auth-forgot">
        Forgot password?
      </Link>
      <button className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      <p className="auth-foot">
        New to Atlas?{' '}
        <Link href={`/signup${query}`} className="link">
          Sign up
        </Link>
      </p>
    </form>
  )
}
