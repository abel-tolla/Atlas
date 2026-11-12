// GET /api/cron/daily-sync: the daily background sync (#65).
//
// Vercel Cron calls this on the schedule in vercel.json and sends
// "Authorization: Bearer <CRON_SECRET>". Anyone else gets a 401. The
// response holds counts only.

import { timingSafeEqual } from 'node:crypto'
import { getDb } from '../../../../db'
import { adapters } from '../../../../server/sync/adapters'
import { syncAllAccounts } from '../../../../server/sync/engine'

// Accounts sync one after another, so give the whole run up to 5 minutes.
export const maxDuration = 300

function authorized(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  // Compared in constant time, so the secret can't be guessed by timing.
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET is not set, so the daily sync is turned off.')
    return Response.json({ error: 'Not configured.' }, { status: 503 })
  }
  if (!authorized(request, secret)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const results = await syncAllAccounts(getDb(), { adapters })
  const tally = (outcome: string) => results.filter((r) => r.outcome === outcome).length
  return Response.json({
    accounts: results.length,
    succeeded: tally('succeeded'),
    failed: tally('failed'),
    needsReconnect: tally('needs_reconnect'),
    skipped: tally('skipped'),
  })
}
