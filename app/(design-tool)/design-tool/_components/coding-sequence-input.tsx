'use client'
import { useCallback, useRef, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormAssistiveText,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload } from 'lucide-react'
import { FormValues } from './form-schema'
import { SequenceWarnings } from './sequence-warnings'
import { SequenceHighlight } from './sequence-highlight'
import { cn } from '@/lib/utils'
import { cleanSequence, parseFasta } from '@/lib/fasta'
import { detectSequenceType } from '@/lib/sequence-utils'
import { toast } from 'sonner'

const MAX_LENGTH = 50_000

export function CodingSequenceInput() {
  const { control, watch, setValue } = useFormContext<FormValues>()
  const value = watch('codingSequence')
  const inputType = watch('inputType')
  const length = value?.length ?? 0
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Auto-detect sequence type when value changes
  useEffect(() => {
    if (value) {
      const detected = detectSequenceType(value)
      if (detected !== inputType) {
        setValue('inputType', detected)
      }
    }
  }, [value, inputType, setValue])

  const syncScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const applyCleanedSequence = useCallback(
    (text: string, source: string) => {
      const detected = detectSequenceType(text)

      if (detected === 'amino_acid') {
        // For amino acid input, just strip whitespace and headers
        const lines = text.split(/\r?\n/)
        let removedHeaders = 0
        const seqLines: string[] = []
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('>')) {
            removedHeaders++
            continue
          }
          seqLines.push(trimmed)
        }
        const cleaned = seqLines.join('').replace(/\s/g, '').toUpperCase()

        if (cleaned.length === 0) {
          toast.error('No valid amino acid characters found.')
          return
        }

        setValue('codingSequence', cleaned, { shouldValidate: true })
        setValue('inputType', 'amino_acid')

        const parts: string[] = ['detected as amino acid sequence']
        if (removedHeaders > 0)
          parts.push(
            `${removedHeaders} header${removedHeaders > 1 ? 's' : ''} stripped`,
          )

        toast.info(`${source}: ${parts.join(', ')}.`)
        return
      }

      const { cleaned, removedChars, removedHeaders } = cleanSequence(text)

      if (cleaned.length === 0) {
        toast.error('No valid nucleotide characters found.')
        return
      }

      setValue('codingSequence', cleaned, { shouldValidate: true })
      setValue('inputType', 'nucleotide')

      const parts: string[] = []
      if (removedHeaders > 0)
        parts.push(
          `${removedHeaders} header${removedHeaders > 1 ? 's' : ''} stripped`,
        )
      if (removedChars > 0)
        parts.push(`${removedChars} non-nucleotide character${removedChars > 1 ? 's' : ''} removed`)

      if (parts.length > 0) {
        toast.info(`${source}: ${parts.join(', ')}.`)
      }
    },
    [setValue],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData('text')
      const hasHeaders = text.includes('>')
      const nonNuc = text.replace(/[ACGTUacgtu\s\r\n]/g, '')
      if (hasHeaders || nonNuc.length > 3) {
        e.preventDefault()
        applyCleanedSequence(text, 'Paste cleaned')
      }
    },
    [applyCleanedSequence],
  )

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        const entries = parseFasta(text)

        if (entries.length > 0 && entries[0].header) {
          const currentName = watch('name')
          if (!currentName) {
            setValue('name', entries[0].header.slice(0, 250))
          }
        }

        applyCleanedSequence(text, 'FASTA imported')
      }
      reader.readAsText(file)

      e.target.value = ''
    },
    [applyCleanedSequence, setValue, watch],
  )

  const sharedTextStyles =
    'px-3 py-2 font-mono text-sm leading-normal break-all whitespace-pre-wrap'

  return (
    <FormField
      name="codingSequence"
      control={control}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FormLabel>
                Enter your sequence <span aria-hidden="true">*</span>
              </FormLabel>
              {value && (
                <Badge variant={inputType === 'amino_acid' ? 'secondary' : 'outline'} className="text-[10px]">
                  {inputType === 'amino_acid' ? 'Amino Acid' : 'Nucleotide'}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3" />
              Upload FASTA
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".fasta,.fa,.fna,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <FormControl>
            <div className="relative min-h-[6.5rem]">
              <div
                ref={backdropRef}
                aria-hidden="true"
                className={cn(
                  sharedTextStyles,
                  'pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent',
                  'text-foreground',
                )}
              >
                {value ? (
                  inputType === 'amino_acid' ? (
                    <span>{value}</span>
                  ) : (
                    <SequenceHighlight sequence={value} />
                  )
                ) : (
                  <span className="text-transparent">placeholder</span>
                )}
              </div>
              <textarea
                placeholder="ATGATTACA... or MIVT... (paste nucleotide or amino acid sequence)"
                rows={4}
                aria-required="true"
                {...field}
                ref={(el) => {
                  field.ref(el)
                  ;(textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
                }}
                onPaste={handlePaste}
                onScroll={syncScroll}
                className={cn(
                  sharedTextStyles,
                  'border-input placeholder:text-muted-foreground selection:bg-primary/30 relative flex w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                  'resize-y text-transparent caret-foreground',
                )}
              />
            </div>
          </FormControl>
          <FormAssistiveText className="min-w-0">
            <span className="flex min-h-5 items-start justify-between gap-4">
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  length > MAX_LENGTH
                    ? 'text-destructive-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
                {inputType === 'amino_acid' ? ' aa' : ' bp'}
              </span>
            </span>
          </FormAssistiveText>
          {inputType === 'amino_acid' && (
            <p className="text-muted-foreground text-xs">
              Amino acid sequence detected. It will be converted to a coding
              sequence using codon optimization for the selected species before
              processing.
            </p>
          )}
          {inputType === 'nucleotide' && <SequenceWarnings />}
        </FormItem>
      )}
    />
  )
}
