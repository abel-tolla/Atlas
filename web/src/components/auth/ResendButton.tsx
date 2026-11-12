'use client'

import { useEffect, useState, useTransition } from 'react'
import { resendVerification } from '../../lib/auth/actions'

const COOLDOWN_S = 60

/** "Send it again". Waits 60 seconds between sends; the server limits it to 3 an hour as well. */
export function ResendButton({
  email = '',
  from,
  label = 'Resend email',
  startWaiting = false,
}: {
  email?: string
  from?: string
  label?: string
  startWaiting?: boolean
}) {
  const [wait, setWait] = useState(startWaiting ? COOLDOWN_S : 0)
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  return (
    <div className="resend">
      <button
        type="button"
        className="btn"
        disabled={pending || wait > 0}
        onClick={() =>
          start(async () => {
            const { ok } = await resendVerification(email, from)
            setFailed(!ok)
            setSent(ok)
            if (ok) setWait(COOLDOWN_S)
          })
        }
      >
        {wait > 0 ? `${label} (${wait}s)` : label}
      </button>
      <p className="hint" role="status">
        {failed
          ? 'We couldn’t send the email. Try again in a minute.'
          : sent
            ? 'If that address needs verifying, we sent a new link.'
            : ''}
      </p>
    </div>
  )
}
