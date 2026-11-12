import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema'

/**
 * Any Drizzle Postgres database with Atlas's schema: Neon in the app,
 * PGlite in tests. Server code that takes a database uses this type, so
 * tests can pass their own.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>
