import Database from 'better-sqlite3'
import path from 'node:path'

let _db: ReturnType<typeof Database> | null = null

export function getDb() {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data.db')
    _db = new Database(dbPath, { readonly: true })
    _db.pragma('journal_mode = WAL')
  }
  return _db
}

/** Reset the cached connection (used by tests). */
export function resetDb() {
  if (_db) {
    _db.close()
    _db = null
  }
}
