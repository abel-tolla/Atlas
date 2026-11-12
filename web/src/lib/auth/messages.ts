// What the login pages say for each error code. No token or technical detail
// ever reaches the screen or the address bar (#51).

const MESSAGES: Record<string, string> = {
  // Auth.js error codes, from /login?error=...
  AccessDenied: 'You cancelled sign-in. Nothing was saved.',
  OAuthAccountNotLinked:
    'This email already uses another sign-in. Use the one you chose first.',
  OAuthCallbackError: 'Google or Microsoft didn’t answer as expected. Try again.',
  OAuthSignin: 'Google or Microsoft didn’t answer as expected. Try again.',
  Callback: 'Google or Microsoft didn’t answer as expected. Try again.',
  // Our own codes, from the forms and from /login?error=CredentialsSignin&code=...
  invalid_credentials: 'Incorrect email or password.',
  credentials: 'Incorrect email or password.',
  email_not_verified: 'Check your inbox to verify your email.',
  too_many_attempts: 'Too many tries. Wait a few minutes and try again.',
  too_short: 'Use at least 8 characters.',
  too_long: 'Use 128 characters or fewer.',
  common: 'That password is too common. Pick another.',
  invalid_email: 'Enter a valid email address.',
  name_required: 'Enter your name.',
  passwords_differ: 'The two passwords don’t match.',
  invalid_token: 'This link has expired. Ask for a new one.',
  mail_failed: 'We couldn’t send the email. Try again in a minute.',
}

const FALLBACK = 'Sign-in isn’t working right now. Try again in a minute.'

/** Picks the message for an Auth.js `error` and optional `code`. Unknown codes get the fallback. */
export function messageFor(error?: string | null, code?: string | null): string | null {
  if (!error && !code) return null
  if (error === 'CredentialsSignin') return MESSAGES[code ?? ''] ?? MESSAGES.invalid_credentials
  return MESSAGES[error ?? ''] ?? MESSAGES[code ?? ''] ?? FALLBACK
}

/**
 * A return address must stay inside Atlas: a path that starts with `/` but not
 * `//` or `/\`, so the login page can't send people to another site.
 */
export function safeFrom(from: unknown): string {
  if (typeof from !== 'string') return '/'
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return '/'
  if (/[\u0000-\u001f]/.test(from)) return '/'
  return from
}
