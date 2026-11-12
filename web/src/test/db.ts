import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Db } from '../db'
import * as schema from '../db/schema'
import type { Mail } from '../lib/auth/email'

/** A fresh in-memory Postgres with the real migrations applied. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: 'drizzle' })
  return db as unknown as Db
}

/** A fake mailer that keeps what it was asked to send. */
export function createInbox() {
  const sent: Mail[] = []
  return {
    sent,
    send: async (mail: Mail) => void sent.push(mail),
    /** The token in the newest email to this address. */
    tokenFor(to: string): string {
      const mail = [...sent].reverse().find((m) => m.to === to)
      const token = mail && new URL(mail.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')
      if (!token) throw new Error(`No link emailed to ${to}`)
      return token
    },
  }
}
