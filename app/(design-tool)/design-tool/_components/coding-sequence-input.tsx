'use client'
import { useCallback, useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormAssistiveText,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { FormValues } from './form-schema'
import { SequenceWarnings } from './sequence-warnings'
import { SequenceHighlight } from './sequence-highlight'
import { cn } from '@/lib/utils'
import { cleanSequence, parseFasta } from '@/lib/fasta'
import { toast } from 'sonner'

const MAX_LENGTH = 50_000

export function CodingSequenceInput() {
  const { control, watch, setValue } = useFormContext<FormValues>()
  const value = watch('codingSequence')
  const length = value?.length ?? 0
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const syncScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const applyCleanedSequence = useCallback(
    (text: string, source: string) => {
      const { cleaned, removedChars, removedHeaders } = cleanSequence(text)

      if (cleaned.length === 0) {
        toast.error('No valid nucleotide characters found.')
        return
      }

      setValue('codingSequence', cleaned, { shouldValidate: true })

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
      // Only intercept if the pasted text looks like it needs cleaning
      // (has FASTA headers, line numbers, or significant non-nucleotide chars)
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
          // Use FASTA header as name if name field is empty
          const currentName = watch('name')
          if (!currentName) {
            setValue('name', entries[0].header.slice(0, 250))
          }
        }

        applyCleanedSequence(text, 'FASTA imported')
      }
      reader.readAsText(file)

      // Reset file input so re-selecting the same file triggers onChange
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
            <FormLabel>
              Enter your coding sequence <span aria-hidden="true">*</span>
            </FormLabel>
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
              {/* Highlight backdrop */}
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
                  <SequenceHighlight sequence={value} />
                ) : (
                  <span className="text-transparent">placeholder</span>
                )}
              </div>
              {/* Transparent textarea on top */}
              <textarea
                placeholder="ATGATTACA... (paste sequence or upload FASTA)"
                rows={4}
                aria-required="true"
                {...field}
                ref={(el) => {
                  // Merge refs: react-hook-form's ref + our local ref
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
              </span>
            </span>
          </FormAssistiveText>
          <SequenceWarnings />
        </FormItem>
      )}
    />
  )
}
