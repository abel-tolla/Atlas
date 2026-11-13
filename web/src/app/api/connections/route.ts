// GET /api/connections: the signed-in user's calendar connections, their
// status and their calendars or courses. Never any token or feed link.

import { getDb } from '../../../db'
import { requireUser } from '../../../lib/auth/require-user'
import { listConnections } from '../../../server/connections'

export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  return Response.json({ connections: await listConnections(getDb(), auth.user.id) })
}
