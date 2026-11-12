import { defineConfig } from 'drizzle-kit'

// Next.js loads .env.local by itself, but drizzle-kit doesn't.
try {
  process.loadEnvFile('.env.local')
} catch {
  // No file: the variables may already be set, as on Vercel or in CI.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    // Migrations use Neon's direct connection when there is one, since the
    // pooled connection can drop the session a migration relies on.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
