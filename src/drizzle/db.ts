import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import path from 'path'
import * as schema from './schema'

// Embedded replica: a local SQLite file that syncs from a remote Turso database.
// Reads hit the local file (fast), writes go to the remote (we only read here).
// In Vercel's serverless runtime the filesystem is read-only outside /tmp, so the
// replica lives there; locally we keep it alongside the source data.
const replicaPath =
  process.env.NODE_ENV === 'production'
    ? '/tmp/rej-studio.replica.db'
    : path.join(process.cwd(), 'data', 'rej-studio.replica.db')

const syncUrl = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!syncUrl) {
  throw new Error('TURSO_DATABASE_URL is not set')
}

let _client: Client | null = null
let _db: LibSQLDatabase<typeof schema> | null = null

function getClient() {
  if (!_client) {
    _client = createClient({
      url: `file:${replicaPath}`,
      syncUrl,
      authToken,
      // Periodically refresh from the remote while the process is alive.
      syncInterval: 300,
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

export async function syncReplica() {
  await getClient().sync()
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string]
  },
})
