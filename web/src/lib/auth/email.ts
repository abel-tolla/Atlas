import { Resend } from 'resend'
import { safeFrom } from './messages'

export interface Mail {
  to: string
  subject: string
  text: string
}

export type Mailer = (mail: Mail) => Promise<void>

/** Sends through Resend. In development, with no key, it prints the email instead. */
export const sendMail: Mailer = async (mail) => {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is not set.')
    console.log(`\n[email to ${mail.to}] ${mail.subject}\n${mail.text}\n`)
    return
  }
  const from = process.env.EMAIL_FROM
  if (!from) throw new Error('EMAIL_FROM is not set.')
  const { error } = await new Resend(key).emails.send({ from, ...mail })
  if (error) throw new Error(`Resend failed: ${error.message}`)
}

export const appUrl = () => (process.env.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function link(path: string, token: string, from?: string) {
  const url = new URL(path, appUrl())
  url.searchParams.set('token', token)
  const safe = safeFrom(from)
  if (safe !== '/') url.searchParams.set('from', safe)
  return url.toString()
}

export const verificationMail = (to: string, token: string, from?: string): Mail => ({
  to,
  subject: 'Verify your email for Atlas',
  text: `Welcome to Atlas.\n\nConfirm your email address to finish signing up:\n${link('/verify-email', token, from)}\n\nThe link works for 24 hours. If you didn’t sign up, ignore this email.`,
})

export const resetMail = (to: string, token: string): Mail => ({
  to,
  subject: 'Reset your Atlas password',
  text: `Someone asked to reset the password for this Atlas account.\n\nChoose a new password:\n${link('/reset-password', token)}\n\nThe link works once and expires in 1 hour. If this wasn’t you, ignore this email. Your password stays the same.`,
})

export const duplicateSignupMail = (to: string): Mail => ({
  to,
  subject: 'Someone tried to sign up to Atlas with your email',
  text: `Someone tried to create an Atlas account with this email address, but you already have one.\n\nIf it was you, log in at ${appUrl()}/login. If you forgot your password, use “Forgot password?”.\n\nIf it wasn’t you, ignore this email. Nothing changed.`,
})
