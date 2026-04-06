import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL ?? ''

// PGlite uses the 'postgresql' dialect (it IS Postgres), but drizzle-kit
// needs a driver hint to use the PGlite adapter instead of pg/neon.
const isPglite =
  databaseUrl === '' ||
  databaseUrl.startsWith('file:') ||
  databaseUrl.startsWith('memory:')

export default defineConfig({
  schema: './src/drizzle/schema.ts',
  out: './src/drizzle/migrations',
  dialect: 'postgresql',
  ...(isPglite
    ? {
        driver: 'pglite',
        dbCredentials: { url: databaseUrl || 'file:./data/local.db' },
      }
    : { dbCredentials: { url: databaseUrl } }),
})
