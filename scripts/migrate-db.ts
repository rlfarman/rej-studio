/**
 * Apply Drizzle SQL migrations against $DATABASE_URL using the Neon HTTP driver.
 *
 * Workflow:
 *   1. Edit src/drizzle/schema.ts
 *   2. pnpm db:generate   # emits SQL to src/drizzle/migrations/
 *   3. Review the diff in a PR
 *   4. pnpm db:migrate    # applies pending migrations to $DATABASE_URL
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const sql = neon(databaseUrl)
const db = drizzle(sql)

async function main() {
  console.log('Applying migrations from src/drizzle/migrations ...')
  await migrate(db, { migrationsFolder: 'src/drizzle/migrations' })
  console.log('Done.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
