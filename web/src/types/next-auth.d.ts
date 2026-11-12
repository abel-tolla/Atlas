import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: { id: string } & import('next-auth').DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** The user's id. */
    uid?: string
    /** The id of the auth_sessions row behind this cookie. */
    sid?: string
  }
}
