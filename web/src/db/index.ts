<<<<<<< HEAD
// The database client for server code: route handlers, server components,
// the sync engine and cron jobs. Importing it from a client component fails
// the build, so the connection string can never reach the browser.

import 'server-only'
import { parseEnv } from '@neon/env'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import neonConfig from '../../neon'
import * as schema from './schema'

export { schema }

// node-postgres with a pool is Neon's recommended driver on Vercel's Fluid
// compute: one instance serves many requests and reuses its connections,
// and it supports the transactions sync needs. attachDatabasePool lets
// Vercel close idle connections before an instance is suspended. Outside
// Vercel it does nothing.
//
// The app uses the pooled DATABASE_URL. Migrations use the direct
// DATABASE_URL_UNPOOLED instead (see drizzle.config.ts).
function create() {
  // Checks the env against neon.ts and names any missing variable.
  const { postgres } = parseEnv(neonConfig, ['DATABASE_URL'])
  const pool = new Pool({ connectionString: postgres.databaseUrl })
  attachDatabasePool(pool)
  return drizzle({ client: pool, schema })
}

// One pool per server instance, reused across hot reloads in development.
const cache = globalThis as unknown as { atlasDb?: ReturnType<typeof create> }

/** Connects on first use, so pages that never touch the database build without it. */
export function getDb() {
  cache.atlasDb ??= create()
  return cache.atlasDb
}

export type Db = ReturnType<typeof getDb>
=======
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema'

/** Any Drizzle Postgres database: Neon in production, PGlite in tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>

let db: Db | undefined

/** Created on first use, so `next build` works without DATABASE_URL. */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set.')
    db = drizzle({ client: neon(url), schema })
  }
  return db
}
>>>>>>> 2aabe29 (feat: implemented login)
