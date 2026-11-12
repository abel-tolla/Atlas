'use client'

import { useActionState } from 'react'
import { resetPassword, type FormState } from '../../lib/auth/actions'
import { messageFor } from '../../lib/auth/messages'
import { PasswordField } from './PasswordField'

const initial: FormState = {}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initial)
  const message = state.error ? messageFor(state.error, state.error) : null

  return (
    <form action={action} className="auth-form">
      {message && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      <PasswordField name="password" label="New password" autoComplete="new-password" autoFocus />
      <PasswordField name="confirm" label="Confirm new password" autoComplete="new-password" />
      <button className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}
