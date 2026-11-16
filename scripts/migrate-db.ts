/**
 * Apply Drizzle SQL migrations against $DATABASE_URL.
 *
 * Workflow:
 *   1. Edit src/drizzle/schema.ts
 *   2. pnpm drizzle-kit generate   # emits SQL to src/drizzle/migrations/
 *   3. Review the diff in a PR
 *   4. pnpm tsx scripts/migrate-db.ts   # applies pending migrations
 *
 * Neon (postgres:// URL): runs the migrator over the Neon HTTP driver.
 * PGlite (file: / memory: URL): boots the same client the app uses, which
 * loads the pg_trgm extension bundle and applies pending migrations (and
 * loads the sample seed into an empty database). `drizzle-kit push` can't
 * do this for PGlite: its CLI has no way to load extensions, so the trigram
 * indexes fail there.
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const isPglite =
  databaseUrl.startsWith('file:') || databaseUrl.startsWith('memory:')

async function main() {
  console.log('Applying migrations from src/drizzle/migrations ...')
  if (isPglite) {
    const { getDb } = await import('../src/drizzle/client')
    await getDb()
  } else {
    await migrate(drizzle(neon(databaseUrl!)), {
      migrationsFolder: 'src/drizzle/migrations',
    })
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
