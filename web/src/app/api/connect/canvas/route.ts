// POST /api/connect/canvas: connect Canvas (#190).
//   { "method": "feed", "feedUrl": "https://…/feeds/calendars/user_….ics" }
//   { "method": "token", "schoolUrl": "canvas.school.edu", "token": "…" }
// Checks the link or token with Canvas, saves it sealed, and runs the first
// sync. Answers never include the token or the feed link.

import { getDb } from '../../../../db'
import { requireUser } from '../../../../lib/auth/require-user'
import { ConnectError, connectCanvas, type CanvasConnectInput } from '../../../../server/canvas/connect'
import { adapters } from '../../../../server/sync/adapters'

// The first sync runs inside this request, so a big feed has time to finish.
export const maxDuration = 60

function readInput(body: unknown): CanvasConnectInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (b.method === 'feed' && typeof b.feedUrl === 'string') return { method: 'feed', feedUrl: b.feedUrl }
  if (b.method === 'token' && typeof b.schoolUrl === 'string' && typeof b.token === 'string') {
    return { method: 'token', schoolUrl: b.schoolUrl, token: b.token }
  }
  return null
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const input = readInput(await request.json().catch(() => null))
  if (!input) {
    return Response.json({ error: 'invalid_input', message: 'Choose feed link or access token, and fill in the form.' }, { status: 400 })
  }

  try {
    const { accountId, sync } = await connectCanvas(getDb(), auth.user.id, input, { sync: { adapters } })
    return Response.json(
      { accountId, sync: { outcome: sync.outcome, message: sync.message ?? null, counts: sync.counts ?? null } },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof ConnectError) {
      return Response.json({ error: error.code, message: error.message }, { status: 400 })
    }
    console.error('[connect canvas] failed:', (error as Error).message)
    return Response.json({ error: 'failed', message: 'Something went wrong connecting Canvas. Try again.' }, { status: 500 })
  }
}
