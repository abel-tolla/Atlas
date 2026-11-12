import { getCurrentUser, type CurrentUser } from './current-user'

/**
 * Every API route starts with this (#52). It returns the user, or a 401 with no data.
 * Scope each database query to `user.id`.
 *
 *   const result = await requireUser()
 *   if ('response' in result) return result.response
 *   const { user } = result
 */
export async function requireUser(
  getUser: () => Promise<CurrentUser | null> = getCurrentUser,
): Promise<{ user: CurrentUser } | { response: Response }> {
  const user = await getUser()
  return user ? { user } : { response: new Response(null, { status: 401 }) }
}
