import { defineConfig } from 'drizzle-kit'

// Note: data is loaded into Turso by `pnpm db:upload` (see scripts/upload-to-turso.sh).
// Drizzle is used for read-only typing and Studio — no migrations are authored here.
//
// Mirrors the offline/online split in src/drizzle/db.ts:
//   TURSO_DATABASE_URL set   → connect to Turso (online)
//   TURSO_DATABASE_URL unset → open data/rej-studio.db locally (offline)
const syncUrl = process.env.TURSO_DATABASE_URL

export default defineConfig(
  syncUrl
    ? {
        schema: './src/drizzle/schema.ts',
        dialect: 'turso',
        dbCredentials: {
          url: syncUrl,
          authToken: process.env.TURSO_AUTH_TOKEN,
        },
      }
    : {
        schema: './src/drizzle/schema.ts',
        dialect: 'sqlite',
        dbCredentials: {
          url: './data/rej-studio.db',
        },
      },
)
