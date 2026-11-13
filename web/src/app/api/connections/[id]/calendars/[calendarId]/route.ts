// PATCH /api/connections/:id/calendars/:calendarId  { "visible": boolean }
// Shows or hides one calendar or course (#79, #191). Takes effect on the
// next sync, and the calendar views stop showing it right away.

import { getDb } from '../../../../../../db'
import { requireUser } from '../../../../../../lib/auth/require-user'
import { setCalendarVisible } from '../../../../../../server/connections'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; calendarId: string }> },
) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { visible?: unknown } | null
  if (typeof body?.visible !== 'boolean') {
    return Response.json({ error: 'Send { "visible": true } or { "visible": false }.' }, { status: 400 })
  }
  const { id, calendarId } = await params
  const changed = await setCalendarVisible(getDb(), auth.user.id, id, calendarId, body.visible).catch(() => false)
  return changed
    ? Response.json({ id: calendarId, visible: body.visible })
    : Response.json({ error: 'Not found.' }, { status: 404 })
}
