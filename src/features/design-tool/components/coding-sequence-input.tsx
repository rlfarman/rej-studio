'use client'
import { useCallback, useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Upload, Dna, FlaskConical } from 'lucide-react'
import { FormValues, type SequenceType } from '../types/form-schema'
import { SequenceDiagnostics } from './sequence-diagnostics'
import { SequenceHighlight } from './sequence-highlight'
import { GcSparkline } from '@/components/bio/gc-sparkline'
import { CodonUsageStrip } from './codon-usage-strip'
import { cn } from '@/lib/utils'
import { cleanSequence, parseFasta } from '@/lib/bio/fasta'
import { toast } from 'sonner'
import { isSpecies, type Species } from '@/lib/bio/species'
import { pickDefaultSplitPoint } from '../utils/default-split-point'
import { reverseTranslate } from '@/lib/bio/reverse-translate'

const MAX_DNA_LENGTH = 50_000
const MAX_PROTEIN_LENGTH = 16_666

function SequenceTypeToggle({
  value,
  onChange,
}: {
  value: SequenceType
  onChange: (v: SequenceType) => void
}) {
  const options: { value: SequenceType; label: string; icon: typeof Dna }[] = [
    { value: 'dna', label: 'DNA', icon: Dna },
    { value: 'protein', label: 'Protein', icon: FlaskConical },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Sequence type"
      className="bg-muted inline-flex gap-0.5 rounded-lg p-0.5"
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function CodingSequenceInput() {
  const { control, watch, setValue, clearErrors } = useFormContext<FormValues>()
  const sequenceType = watch('sequenceType') ?? 'dna'
  const isProtein = sequenceType === 'protein'

  const dnaValue = watch('codingSequence')
  const proteinValue = watch('proteinSequence')
  const species = watch('species')

  const activeValue = isProtein ? proteinValue : dnaValue
  const length = activeValue?.length ?? 0
  const maxLength = isProtein ? MAX_PROTEIN_LENGTH : MAX_DNA_LENGTH

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const syncScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const applyReverseTranslation = useCallback(
    (protein: string) => {
      if (!isSpecies(species)) return
      try {
        const dna = reverseTranslate(protein, species as Species)
        setValue('codingSequence', dna, { shouldValidate: false })
        setValue('spliceJunctionPosition', pickDefaultSplitPoint(dna), {
          shouldValidate: false,
        })
      } catch {
        // Validation errors are shown via the form schema
        setValue('codingSequence', '', { shouldValidate: false })
      }
    },
    [species, setValue],
  )

  const applyCleanedSequence = useCallback(
    (text: string, source: string) => {
      const mode = isProtein ? 'protein' : 'dna'
      // If the input contains multiple FASTA entries, use only the first
      let textToClean = text
      let ignoredSequences = 0
      if (text.includes('>')) {
        const fastaEntries = parseFasta(text).filter(
          (e) => e.sequence.length > 0,
        )
        if (fastaEntries.length > 1) {
          ignoredSequences = fastaEntries.length - 1
          const first = fastaEntries[0]
          textToClean = first.header
            ? `>${first.header}\n${first.sequence}`
            : first.sequence
        }
      }

      const { cleaned, removedChars, removedHeaders } = cleanSequence(
        textToClean,
        mode,
      )

      if (cleaned.length === 0) {
        toast.error(
          isProtein
            ? 'No valid amino acid characters found.'
            : 'No valid nucleotide characters found.',
        )
        return
      }

      const field = isProtein ? 'proteinSequence' : 'codingSequence'
      setValue(field as keyof FormValues, cleaned, { shouldValidate: true })

      if (!isProtein) {
        setValue('spliceJunctionPosition', pickDefaultSplitPoint(cleaned), {
          shouldValidate: true,
        })
      } else {
        applyReverseTranslation(cleaned)
      }

      const charType = isProtein ? 'non-amino-acid' : 'non-nucleotide'
      const parts: string[] = []
      if (ignoredSequences > 0)
        parts.push(
          `used first sequence (${ignoredSequences} additional sequence${ignoredSequences > 1 ? 's' : ''} ignored)`,
        )
      if (removedHeaders > 0)
        parts.push(
          `${removedHeaders} header${removedHeaders > 1 ? 's' : ''} stripped`,
        )
      if (removedChars > 0)
        parts.push(
          `${removedChars} ${charType} character${removedChars > 1 ? 's' : ''} removed`,
        )

      if (parts.length > 0) {
        toast.info(`${source}: ${parts.join(', ')}.`)
      }
    },
    [setValue, isProtein, applyReverseTranslation],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData('text')
      const hasHeaders = text.includes('>')
      const validChars = isProtein
        ? /[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy*\s\r\n]/g
        : /[ACGTUacgtu\s\r\n]/g
      const nonValid = text.replace(validChars, '')
      if (hasHeaders || nonValid.length > 3) {
        e.preventDefault()
        applyCleanedSequence(text, 'Paste cleaned')
      }
    },
    [applyCleanedSequence, isProtein],
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

  const handleSequenceTypeChange = useCallback(
    (newType: SequenceType) => {
      if (newType === sequenceType) return
      // Clear both sequence fields when switching modes
      setValue('sequenceType', newType)
      setValue('codingSequence', '', { shouldValidate: false })
      setValue('proteinSequence', '', { shouldValidate: false })
      setValue('spliceJunctionPosition', 1, { shouldValidate: false })
      clearErrors(['codingSequence', 'proteinSequence', 'species'])
    },
    [sequenceType, setValue, clearErrors],
  )

  const activeField = isProtein ? 'proteinSequence' : 'codingSequence'
  const fileAccept = isProtein ? '.fasta,.fa,.faa,.txt' : '.fasta,.fa,.fna,.txt'

  const sharedTextStyles =
    'px-3 py-2 font-mono text-sm leading-normal break-all whitespace-pre-wrap'

  return (
    <FormField
      name={activeField}
      control={control}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FormLabel>
                {isProtein
                  ? 'Enter your protein sequence'
                  : 'Enter your coding sequence'}{' '}
                <span aria-hidden="true">*</span>
              </FormLabel>
              <SequenceTypeToggle
                value={sequenceType}
                onChange={handleSequenceTypeChange}
              />
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
              accept={fileAccept}
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <FormControl>
            <div className="relative min-h-[6.5rem]">
              {/* Highlight backdrop — DNA mode only */}
              {!isProtein && (
                <div
                  ref={backdropRef}
                  aria-hidden="true"
                  className={cn(
                    sharedTextStyles,
                    'pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent',
                    'text-foreground',
                  )}
                >
                  {activeValue ? (
                    <SequenceHighlight sequence={activeValue} />
                  ) : (
                    <span className="text-transparent">placeholder</span>
                  )}
                </div>
              )}
              <textarea
                placeholder={
                  isProtein
                    ? 'MVLSPADKTN... (paste amino acid sequence or upload FASTA)'
                    : 'ATGATTACA... (paste sequence or upload FASTA)'
                }
                rows={4}
                aria-required="true"
                {...field}
                onChange={(e) => {
                  field.onChange(e)
                  // In protein mode, reverse-translate on each change
                  if (isProtein) {
                    const val = e.target.value.toUpperCase().replace(/\s/g, '')
                    applyReverseTranslation(val)
                  }
                }}
                ref={(el) => {
                  field.ref(el)
                  ;(
                    textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
                  ).current = el
                }}
                onPaste={handlePaste}
                onScroll={syncScroll}
                className={cn(
                  sharedTextStyles,
                  'border-input placeholder:text-muted-foreground selection:bg-primary/30 relative flex w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                  // In DNA mode, text is transparent (highlight backdrop shows through)
                  // In protein mode, text is visible directly
                  isProtein
                    ? 'caret-foreground resize-y'
                    : 'caret-foreground resize-y text-transparent',
                )}
              />
            </div>
          </FormControl>
          <FormMessage />
          <p
            className={cn(
              'text-sm leading-5 tabular-nums',
              length > maxLength
                ? 'text-destructive-foreground'
                : 'text-muted-foreground',
            )}
          >
            {length.toLocaleString()} {isProtein ? 'residues' : 'bp'} /{' '}
            {maxLength.toLocaleString()}
          </p>
          {isProtein && isSpecies(species) && dnaValue && (
            <p className="text-muted-foreground text-sm">
              → {dnaValue.length.toLocaleString()} bp DNA generated ({species}{' '}
              codon preferences)
            </p>
          )}
          {isProtein && !isSpecies(species) && length > 0 && (
            <p className="text-muted-foreground text-sm text-amber-600 dark:text-amber-400">
              Select a species above to generate the DNA sequence.
            </p>
          )}
          {!isProtein && <SequenceDiagnostics />}
          {!isProtein && dnaValue && dnaValue.length >= 60 && (
            <div className="space-y-2 pt-1">
              <GcSparkline sequence={dnaValue} />
              {isSpecies(species) && dnaValue.length % 3 === 0 && (
                <CodonUsageStrip sequence={dnaValue} species={species} />
              )}
            </div>
          )}
          {isProtein && dnaValue && dnaValue.length >= 60 && (
            <div className="space-y-2 pt-1">
              <GcSparkline sequence={dnaValue} />
            </div>
          )}
        </FormItem>
      )}
    />
  )
}
