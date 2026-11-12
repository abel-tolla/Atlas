// GET /api/health: is the database reachable, and has the schema been
// migrated? Useful after `vercel env pull`, after a deploy, or when a
// teammate switches Neon branches.
//
// This is the one API route that works without signing in, so it reports
// only counts and timings, never data or error details.

import { sql } from 'drizzle-orm'
import { getDb } from '../../../db'

export async function GET() {
  const started = performance.now()
  try {
    const db = getDb()
    const found = await db.execute<{ tables: number; journal: boolean }>(sql`
      select
        (select count(*)::int from information_schema.tables where table_schema = 'public') as tables,
        to_regclass('drizzle.__drizzle_migrations') is not null as journal
    `)
    const { tables, journal } = found.rows[0]
    // Asked separately: Postgres rejects a query that names a missing
    // table, even inside a branch that would never run.
    const migrations = journal
      ? (await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`))
          .rows[0].n
      : 0
    return Response.json({
      database: 'ok',
      migrated: migrations > 0,
      migrations,
      tables,
      ms: Math.round(performance.now() - started),
    })
  } catch (error) {
    // Logged on the server only. The response stays generic.
    // Drizzle wraps the driver's error, so its own message is in `cause`.
    const { message, cause } = error as Error & { cause?: Error }
    console.error('[health] database check failed:', cause?.message ?? message)
    return Response.json({ database: 'unreachable' }, { status: 503 })
  }
}
