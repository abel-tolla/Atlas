// POST /api/sync: Sync Now (#66). Syncs all of the signed-in user's
// connections, at most once a minute. The cooldown is enforced here on the
// server, so calling the route directly can't skip it.

import { getDb } from '../../../db'
import { requireUser } from '../../../lib/auth/require-user'
import { adapters } from '../../../server/sync/adapters'
import { CooldownError, syncNow } from '../../../server/sync/engine'

export const maxDuration = 300

export async function POST() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  try {
    const results = await syncNow(getDb(), auth.user.id, { adapters })
    return Response.json({
      results: results.map(({ accountId, outcome, message, counts }) => ({
        accountId,
        outcome,
        message: message ?? null,
        counts: counts ?? null,
      })),
    })
  } catch (error) {
    if (error instanceof CooldownError) {
      return Response.json(
        { error: 'cooldown', message: error.message, retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
      )
    }
    throw error
  }
}
