import { downloadTextFile } from '@/lib/download-file'

const STORAGE_KEYS = ['favoriteGenes', 'recentGenes', 'rej-studio:job-history']
const EXPORT_VERSION = 1

interface ExportPayload {
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

export function exportUserData() {
  const data: Record<string, unknown> = {}
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        data[key] = JSON.parse(raw)
      } catch {
        data[key] = raw
      }
    }
  }

  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }

  const date = new Date().toISOString().slice(0, 10)
  downloadTextFile(
    `rej-studio-backup-${date}.json`,
    JSON.stringify(payload, null, 2),
  )
}

export function importUserData(file: File): Promise<{ imported: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string) as ExportPayload
        if (!payload.version || !payload.data) {
          throw new Error('Invalid backup file format')
        }

        let imported = 0
        for (const key of STORAGE_KEYS) {
          if (key in payload.data) {
            localStorage.setItem(key, JSON.stringify(payload.data[key]))
            window.dispatchEvent(new Event(`local-storage:${key}`))
            imported++
          }
        }

        resolve({ imported })
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Failed to parse backup file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
