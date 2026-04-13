'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  parseBatchFile,
  MAX_BATCH_SIZE,
  type BatchEntry,
} from '@/features/design-tool/utils/parse-batch-file'

interface BatchUploadProps {
  entries: BatchEntry[]
  onEntriesChange: (entries: BatchEntry[]) => void
}

export function BatchUpload({ entries, onEntriesChange }: BatchUploadProps) {
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    (file: File) => {
      setFileError(null)
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        const result = parseBatchFile(text, file.name)
        if (result.fileError) {
          setFileError(result.fileError)
          onEntriesChange([])
        } else {
          onEntriesChange(result.entries)
        }
      }
      reader.readAsText(file)
    },
    [onEntriesChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      e.target.value = ''
    },
    [processFile],
  )

  const handleRemoveEntry = useCallback(
    (index: number) => {
      onEntriesChange(entries.filter((_, i) => i !== index))
    },
    [entries, onEntriesChange],
  )

  const handleClear = useCallback(() => {
    onEntriesChange([])
    setFileName(null)
    setFileError(null)
  }, [onEntriesChange])

  const validCount = entries.filter(
    (e) => e.validationErrors.length === 0,
  ).length
  const invalidCount = entries.length - validCount

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
          )}
        >
          <Upload className="text-muted-foreground size-8" />
          <div>
            <p className="text-sm font-medium">
              Drop a FASTA or CSV file here, or click to browse
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              .fasta, .fa, .csv — up to {MAX_BATCH_SIZE} sequences
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".fasta,.fa,.fna,.faa,.csv,.txt"
          className="hidden"
          onChange={handleFileInput}
        />
        {fileError && (
          <p className="text-destructive flex items-center gap-1.5 text-sm">
            <AlertCircle className="size-3.5" />
            {fileError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">{fileName}</span>
          <Badge variant="secondary" className="text-xs">
            {validCount} valid
          </Badge>
          {invalidCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {invalidCount} invalid
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleClear}
        >
          <X className="size-3" />
          Clear
        </Button>
      </div>

      <div className="max-h-80 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead className="w-10">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, i) => {
              const isValid = entry.validationErrors.length === 0
              return (
                <TableRow
                  key={i}
                  className={cn(!isValid && 'bg-destructive/5')}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {entry.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {entry.sequenceType.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.cleanedSequence.length.toLocaleString()}
                    {entry.sequenceType === 'dna' ? ' bp' : ' aa'}
                  </TableCell>
                  <TableCell>
                    {isValid ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="text-destructive size-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <ul className="list-inside list-disc text-xs">
                            {entry.validationErrors.map((err, j) => (
                              <li key={j}>{err}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => handleRemoveEntry(i)}
                    >
                      <X className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
