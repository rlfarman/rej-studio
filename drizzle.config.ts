import { defineConfig } from 'drizzle-kit'

// Note: data is loaded into Turso by `pnpm db:upload` (see scripts/upload-to-turso.sh).
// Drizzle is used for read-only typing and Studio — no migrations are authored here.
export default defineConfig({
  schema: './src/drizzle/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
