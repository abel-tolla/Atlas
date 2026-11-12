import { DrizzleAdapter } from '@auth/drizzle-adapter'
import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { headers } from 'next/headers'
import { getDb } from './db'
import { accounts, users, verificationTokens } from './db/schema'
import { checkCredentials, dropUnverifiedClaim, verifyEmailToken } from './lib/auth/service'
import { SESSION_MAX_AGE_MS, checkSession, createSession, deleteSession } from './lib/auth/sessions'

// All Auth.js code lives here and in the route handler (Login Plan.md, Risks).

class EmailNotVerified extends CredentialsSignin {
  code = 'email_not_verified'
}
class TooManyAttempts extends CredentialsSignin {
  code = 'too_many_attempts'
}

export function clientIp(h: Headers): string {
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

async function requestMeta() {
  try {
    const h = await headers()
    return { ipAddress: clientIp(h), userAgent: h.get('user-agent') }
  } catch {
    return {}
  }
}

// The function form builds the config on first use, so `next build` needs no DATABASE_URL.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb()
  const base = DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  })

  return {
    adapter: {
      ...base,
      // Sign-in only needs to know who the user is, so the provider's tokens are never saved (F-40).
      linkAccount: (account) =>
        base.linkAccount!({
          ...account,
          access_token: undefined,
          refresh_token: undefined,
          id_token: undefined,
          expires_at: undefined,
          token_type: undefined,
          scope: undefined,
          session_state: undefined,
        }),
    },
    // Auth.js's Credentials provider can't use database sessions, so every login method uses
    // a signed cookie that names a row in auth_sessions. See the jwt callback below.
    session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_MS / 1000 },
    pages: { signIn: '/login', error: '/login' },
    providers: [
      Google,
      MicrosoftEntraID({ authorization: { params: { scope: 'openid profile email' } } }),
      Credentials({
        id: 'credentials',
        credentials: { email: {}, password: {} },
        async authorize(credentials, request) {
          const result = await checkCredentials(
            { db },
            {
              email: String(credentials?.email ?? ''),
              password: String(credentials?.password ?? ''),
              ip: clientIp(request.headers),
            },
          )
          if (result.status === 'limited') throw new TooManyAttempts()
          if (result.status === 'unverified') throw new EmailNotVerified()
          if (result.status !== 'ok') return null
          const { id, name, email, image } = result.user
          return { id, name, email, image }
        },
      }),
      // The link in the verification email signs the user in after it verifies the address.
      Credentials({
        id: 'verify-email',
        credentials: { token: {} },
        async authorize(credentials) {
          const user = await verifyEmailToken({ db }, String(credentials?.token ?? ''))
          if (!user) return null
          return { id: user.id, name: user.name, email: user.email, image: user.image }
        },
      }),
    ],
    callbacks: {
      async signIn({ account, user }) {
        if ((account?.type === 'oidc' || account?.type === 'oauth') && user.email) {
          await dropUnverifiedClaim(db, user.email)
        }
        return true
      },
      // Runs on sign-in and on every auth() call. Returning null ends the session.
      async jwt({ token, user }) {
        if (user?.id) {
          token.uid = user.id
          token.sid = await createSession(db, user.id, await requestMeta())
          return token
        }
        if (!token.sid || !(await checkSession(db, token.sid))) return null
        return token
      },
      session({ session, token }) {
        if (token.uid) session.user.id = token.uid
        return session
      },
    },
    events: {
      // Log out deletes the row, so the old cookie stops working at once (#210).
      async signOut(message) {
        if ('token' in message && message.token?.sid) await deleteSession(db, message.token.sid)
      },
    },
  }
})
