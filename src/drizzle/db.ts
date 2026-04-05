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
//   Opens an embedded replica — a local SQLite file that syncs from Turso.
//   Reads hit the local file (fast); sync happens on boot and every 5 minutes.
//   The replica lives at data/rej-studio.replica.db in dev, /tmp/ in prod.

const syncUrl = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

function getUrl(): string {
  if (syncUrl) {
    const replicaPath =
      process.env.NODE_ENV === 'production'
        ? '/tmp/rej-studio.replica.db'
        : path.join(process.cwd(), 'data', 'rej-studio.replica.db')
    return `file:${replicaPath}`
  }
  return `file:${path.join(process.cwd(), 'data', 'rej-studio.db')}`
}

let _client: Client | null = null
let _db: LibSQLDatabase<typeof schema> | null = null

function getClient() {
  if (!_client) {
    const url = getUrl()
    _client = createClient(
      syncUrl ? { url, syncUrl, authToken, syncInterval: 300 } : { url },
    )
  }
  return _client
}

function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema })
  }
  return _db
}

export const isReplica = !!syncUrl

export async function syncReplica() {
  if (!isReplica) return
  await getClient().sync()
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string]
  },
})
