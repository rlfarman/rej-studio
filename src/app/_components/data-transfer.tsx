'use client'

import { useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportUserData, importUserData } from '@/lib/data-transfer'
import { toast } from 'sonner'

export function DataTransfer() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { imported } = await importUserData(file)
      toast.success(
        `Imported ${imported} data ${imported === 1 ? 'category' : 'categories'}`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }

    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={exportUserData}
      >
        <Download className="h-4 w-4" />
        Export data
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        Import data
      </Button>
    </div>
  )
}
