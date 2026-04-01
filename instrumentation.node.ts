import fs from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'

const DB_GZ_PATH = path.join(process.cwd(), 'data', 'rej-studio.db.gz')
const DB_PATH = '/tmp/rej-studio.db'

if (!fs.existsSync(DB_PATH)) {
  console.log('[instrumentation] Decompressing SQLite database to /tmp...')
  const start = Date.now()

  const compressed = fs.readFileSync(DB_GZ_PATH)
  const decompressed = gunzipSync(compressed)
  fs.writeFileSync(DB_PATH, decompressed)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const sizeMB = (decompressed.length / 1024 / 1024).toFixed(1)
  console.log(`[instrumentation] Database ready: ${sizeMB} MB (${elapsed}s)`)
}
