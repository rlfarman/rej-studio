import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import path from 'path'
import * as schema from './schema'

// Two modes:
//
// Offline (TURSO_DATABASE_URL not set):
//   Opens data/rej-studio.db as a plain local file. No network required.
//   Build the file first with `pnpm db:build`.
//
// Online (TURSO_DATABASE_URL set):
//   Talks to Turso directly over HTTP. Every query is a round-trip.
//   Uses row-read quota (generous) instead of sync quota (tiny on free tier).

const remoteUrl = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

let _client: Client | null = null
let _db: LibSQLDatabase<typeof schema> | null = null

function getClient() {
  if (!_client) {
    _client = remoteUrl
      ? createClient({ url: remoteUrl, authToken })
      : createClient({
          url: `file:${path.join(process.cwd(), 'data', 'rej-studio.db')}`,
        })
  }
  return _client
}

function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema })
  }
  return _db
}

export const isReplica = false

export async function syncReplica() {
  // No-op: we talk to Turso directly, no embedded replica to sync.
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string]
  },
})
