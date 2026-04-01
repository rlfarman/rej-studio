import fs from 'fs'
import path from 'path'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'

const DB_GZ_PATH = path.join(process.cwd(), 'data', 'rej-studio.db.gz')
const DB_PATH =
  process.env.NODE_ENV === 'production'
    ? '/tmp/rej-studio.db'
    : path.join(process.cwd(), 'data', 'rej-studio.db')

export async function register() {
  if (process.env.NODE_ENV !== 'production') return
  if (fs.existsSync(DB_PATH)) return

  console.log('[instrumentation] Decompressing SQLite database to /tmp...')
  const start = Date.now()

  await pipeline(
    fs.createReadStream(DB_GZ_PATH),
    createGunzip(),
    fs.createWriteStream(DB_PATH),
  )

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[instrumentation] Database ready (${elapsed}s)`)
}
