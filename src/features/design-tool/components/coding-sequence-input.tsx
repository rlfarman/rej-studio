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
import { cn } from '@/lib/utils'
import { cleanSequence, parseFasta } from '@/lib/bio/fasta'
import { detectSequenceType } from '@/lib/bio/sequence-utils'
import { toast } from 'sonner'
import { isSpecies, type Species } from '@/lib/bio/species'
import { pickDefaultSplitPoints } from '../utils/default-split-point'
import { reverseTranslate } from '@/lib/bio/reverse-translate'
import { translate } from '@/lib/bio/genetic-code'
import { designToolCopy } from '../copy'

const copy = designToolCopy.sequenceInput

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
    { value: 'dna', label: copy.typeDna, icon: Dna },
    { value: 'protein', label: copy.typeProtein, icon: FlaskConical },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={copy.typeToggleAria}
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
                ? 'bg-primary text-primary-foreground shadow-sm'
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
        const points = pickDefaultSplitPoints(dna)
        setValue('codingSequence', dna, { shouldValidate: false })
        setValue('spliceJunctionPositions', points, {
          shouldValidate: false,
        })
        setValue(
          'selectedWggwSites',
          points.map(() => null),
          {
            shouldValidate: false,
          },
        )
      } catch {
        // Validation errors are shown via the form schema
        setValue('codingSequence', '', { shouldValidate: false })
      }
    },
    [species, setValue],
  )

  const applyCleanedSequence = useCallback(
    (text: string, source: string) => {
      // Auto-detect DNA vs protein from the raw input so paste/upload
      // switch mode when the user drops in the other kind of sequence.
      const detected = detectSequenceType(text)
      const detectedIsProtein = detected === 'protein'

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
        detected,
      )

      if (cleaned.length === 0) {
        toast.error(
          detectedIsProtein ? copy.noValidAminoAcids : copy.noValidNucleotides,
        )
        return
      }

      const modeSwitched = detected !== sequenceType
      if (modeSwitched) {
        setValue('sequenceType', detected)
        clearErrors(['codingSequence', 'proteinSequence', 'species'])
        if (detectedIsProtein && species === 'none') {
          setValue('species', 'human', { shouldValidate: false })
        }
      }

      const field = detectedIsProtein ? 'proteinSequence' : 'codingSequence'
      setValue(field as keyof FormValues, cleaned, { shouldValidate: true })

      if (!detectedIsProtein) {
        const points = pickDefaultSplitPoints(cleaned)
        setValue('spliceJunctionPositions', points, {
          shouldValidate: true,
        })
        setValue(
          'selectedWggwSites',
          points.map(() => null),
          {
            shouldValidate: false,
          },
        )
        // Clear the protein field so switching back doesn't show stale input
        if (modeSwitched) {
          setValue('proteinSequence', '', { shouldValidate: false })
        }
      } else {
        applyReverseTranslation(cleaned)
        if (modeSwitched) {
          // DNA field will be repopulated by reverse-translation when species is set
        }
      }

      const charType = detectedIsProtein
        ? copy.charTypeNonAminoAcid
        : copy.charTypeNonNucleotide
      const parts: string[] = []
      if (ignoredSequences > 0)
        parts.push(copy.usedFirstSequence(ignoredSequences))
      if (removedHeaders > 0) parts.push(copy.headersStripped(removedHeaders))
      if (removedChars > 0)
        parts.push(copy.charsRemoved(removedChars, charType))

      if (parts.length > 0) {
        toast.info(copy.cleanedSummary(source, parts.join(', ')))
      }
    },
    [setValue, clearErrors, sequenceType, species, applyReverseTranslation],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData('text')
      const hasHeaders = text.includes('>')
      // Intercept anything that looks like a sequence paste so we can
      // auto-detect DNA vs protein and clean in one step.
      const letters = text.replace(/\s/g, '')
      const seqChars =
        letters.match(/[ACDEFGHIKLMNPQRSTUVWYacdefghiklmnpqrstuvwy*]/g)
          ?.length ?? 0
      const looksLikeSequence =
        letters.length >= 6 && seqChars / letters.length > 0.8
      if (hasHeaders || looksLikeSequence) {
        e.preventDefault()
        applyCleanedSequence(text, copy.pasteSource)
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

        applyCleanedSequence(text, copy.fastaSource)
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [applyCleanedSequence, setValue, watch],
  )

  const handleSequenceTypeChange = useCallback(
    (newType: SequenceType) => {
      if (newType === sequenceType) return
      setValue('sequenceType', newType)
      clearErrors(['codingSequence', 'proteinSequence', 'species'])

      if (newType === 'protein') {
        // Reverse-translation needs a codon table; default to human if none set.
        if (species === 'none') {
          setValue('species', 'human', { shouldValidate: false })
        }
        // DNA → Protein: translate existing DNA (trailing stop stripped)
        const dna = (dnaValue ?? '').toUpperCase().replace(/U/g, 'T')
        if (dna.length >= 3) {
          const protein = translate(dna).replace(/\*+$/, '')
          setValue('proteinSequence', protein, { shouldValidate: false })
        }
      } else {
        // Protein → DNA: reverse-translate (needs species)
        const protein = (proteinValue ?? '').toUpperCase().replace(/\s/g, '')
        if (protein.length > 0) {
          applyReverseTranslation(protein)
        }
      }
    },
    [
      sequenceType,
      setValue,
      clearErrors,
      dnaValue,
      proteinValue,
      species,
      applyReverseTranslation,
    ],
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <FormLabel>
                {isProtein ? copy.labelProtein : copy.labelDna}{' '}
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
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={() => fileInputRef.current?.click()}
              aria-label={copy.uploadAria}
            >
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">{copy.uploadLong}</span>
              <span className="sm:hidden">{copy.uploadShort}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={fileAccept}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
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
                  isProtein ? copy.placeholderProtein : copy.placeholderDna
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
            {length.toLocaleString()}{' '}
            {isProtein ? copy.unitResidues : copy.unitBp} /{' '}
            {maxLength.toLocaleString()}
          </p>
          {isProtein && isSpecies(species) && dnaValue && (
            <p className="text-muted-foreground text-sm">
              {copy.reverseTranslated(
                dnaValue.length.toLocaleString(),
                species,
              )}
            </p>
          )}
          {isProtein && !isSpecies(species) && length > 0 && (
            <p className="text-warning-soft text-sm">
              {copy.selectSpeciesHint}
            </p>
          )}
          {!isProtein && <SequenceDiagnostics />}
        </FormItem>
      )}
    />
  )
}
