import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'rej-studio.db')

const sqlite = new Database(dbPath, { readonly: true })
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('cache_size = -64000')

export const db = drizzle(sqlite, { schema })
