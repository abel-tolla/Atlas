import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { safeFrom } from './messages'

export interface CurrentUser {
  id: string
  name: string | null
  email: string
  image: string | null
  timeZone: string | null
}

/** The signed-in user, read fresh from Neon, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const [user] = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
  return user ?? null
}

/** For the login, sign-up and forgot-password pages: a signed-in visitor goes on to where they were headed. */
export async function redirectIfSignedIn(from?: unknown) {
  if (await getCurrentUser()) redirect(safeFrom(from))
}
