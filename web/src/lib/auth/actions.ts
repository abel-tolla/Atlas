'use server'

import { AuthError } from 'next-auth'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clientIp, signIn, signOut } from '../../auth'
import { getDb } from '../../db'
import { sendMail } from './email'
import { getCurrentUser } from './current-user'
import { safeFrom } from './messages'
import * as service from './service'

// Server actions behind the login pages. The rules live in service.ts; these
// read the form, call it, and decide where the browser goes next.

export interface FormState {
  /** A code for messageFor() in messages.ts. */
  error?: string
  notice?: string
  /** Kept so the form can refill the field after an error. Never the password. */
  email?: string
  name?: string
}

const PENDING_EMAIL = 'atlas-pending-email'
const text = (form: FormData, key: string) => String(form.get(key) ?? '')

async function deps() {
  return { db: getDb(), send: sendMail }
}
async function ip() {
  return clientIp(await headers())
}

/** Runs a Credentials sign-in without redirecting. Returns an error code, or nothing on success. */
async function credentialsSignIn(
  provider: 'credentials' | 'verify-email',
  data: Record<string, string>,
): Promise<string | undefined> {
  try {
    const url = await signIn(provider, { ...data, redirect: false })
    const params = new URL(url, 'http://atlas.local').searchParams
    if (params.has('error')) return params.get('code') ?? params.get('error') ?? 'Configuration'
  } catch (e) {
    if (!(e instanceof AuthError)) throw e
    return ('code' in e && typeof e.code === 'string' && e.code) || e.type
  }
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, 'email')
  const error = await credentialsSignIn('credentials', { email, password: text(form, 'password') })
  if (error) return { error, email }
  redirect(safeFrom(text(form, 'from')))
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const from = safeFrom(text(form, 'from'))
  const email = text(form, 'email')
  const name = text(form, 'name')
  try {
    const result = await service.signUpUser(await deps(), {
      name,
      email,
      password: text(form, 'password'),
      from,
      ip: await ip(),
    })
    if (!result.ok) return { error: result.error, email, name }
  } catch (e) {
    console.error('Sign-up failed', e)
    return { error: 'mail_failed', email, name }
  }
  // The "check your inbox" page reads the address from here, not from the address bar.
  ;(await cookies()).set(PENDING_EMAIL, service.normalizeEmail(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  })
  redirect(from === '/' ? '/verify-email' : `/verify-email?from=${encodeURIComponent(from)}`)
}

/** Uses the link from the email, then signs the user in. */
export async function verifyEmail(form: FormData): Promise<void> {
  const error = await credentialsSignIn('verify-email', { token: text(form, 'token') })
  if (error) redirect('/verify-email?error=invalid_token')
  ;(await cookies()).delete(PENDING_EMAIL)
  redirect(safeFrom(text(form, 'from')))
}

/** Sends a new verification link. The answer is the same whether or not an account needs one. */
export async function resendVerification(email: string, from?: string): Promise<{ ok: boolean }> {
  const address = email || (await cookies()).get(PENDING_EMAIL)?.value || ''
  try {
    await service.resendVerification(await deps(), { email: address, from: safeFrom(from), ip: await ip() })
  } catch (e) {
    console.error('Resend failed', e)
    return { ok: false }
  }
  return { ok: true }
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, 'email')
  try {
    await service.requestPasswordReset(await deps(), { email, ip: await ip() })
  } catch (e) {
    // Logged, not shown: an error here would tell the visitor the account exists.
    console.error('Reset email failed', e)
  }
  return { notice: 'sent', email }
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const password = text(form, 'password')
  if (password !== text(form, 'confirm')) return { error: 'passwords_differ' }
  const result = await service.resetPassword(await deps(), { token: text(form, 'token'), password })
  if (!result.ok) return { error: result.error }
  redirect('/login?reset=1')
}

const OAUTH = ['google', 'microsoft-entra-id'] as const

export async function oauthSignIn(provider: string, from: string): Promise<void> {
  if (!(OAUTH as readonly string[]).includes(provider)) redirect('/login')
  await signIn(provider, { redirectTo: safeFrom(from) })
}

export async function logOut(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}

/** Saves the browser's time zone once, on the first visit (F-37). */
export async function saveTimeZone(timeZone: string): Promise<void> {
  const user = await getCurrentUser()
  if (user && !user.timeZone) await service.saveTimeZone(getDb(), user.id, timeZone)
}
