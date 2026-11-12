// Tables for signing in. `users` is shared with the calendar tables.
//
// The Login epic (docs/Login Plan.md) adds the other Auth.js tables here:
// accounts, sessions and verification_tokens, then passes all four to
// DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable,
// verificationTokensTable }). The property names below (id, name, email,
// emailVerified, image) are the ones the adapter expects, so keep them.

import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
  /** IANA name like "America/New_York", sent by the browser on first sign-in (F-37). */
  timeZone: text('time_zone'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
