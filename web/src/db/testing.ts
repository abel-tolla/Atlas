// A real Postgres in memory with every migration applied, for tests.
// Only test files import this.

import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'
import type { Database } from './types'

export async function createTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: 'drizzle' })
  return {
    db: db as unknown as Database,
    /** Empties every table. Call in beforeEach. */
    reset: () => db.execute(sql`truncate users cascade`),
    close: () => client.close(),
  }
}
