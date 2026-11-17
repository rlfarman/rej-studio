'use client'
import { useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
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
      className="inline-flex gap-0.5 rounded-2xl bg-muted p-0.5"
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
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-sm font-medium transition-colors',
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
  const { control, getValues, setValue, clearErrors } =
    useFormContext<FormValues>()
  // useWatch, not watch(): the React Compiler memoizes watch() calls (the
  // function's identity never changes), so the highlight layer kept showing
  // the old sequence while the transparent textarea underneath changed.
  const [watchedType, dnaValue, proteinValue, species] = useWatch({
    control,
    name: ['sequenceType', 'codingSequence', 'proteinSequence', 'species'],
  })
  const sequenceType = watchedType ?? 'dna'
  const isProtein = sequenceType === 'protein'

  const activeValue = isProtein ? proteinValue : dnaValue
  const length = activeValue?.length ?? 0

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const syncScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const applyReverseTranslation = (protein: string) => {
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
      setValue('sequenceType', 'dna', { shouldValidate: false })
    } catch {
      setValue('codingSequence', '', { shouldValidate: false })
    }
  }

  const applyCleanedSequence = (text: string, source: string) => {
    const detected = detectSequenceType(text)
    const detectedIsProtein = detected === 'protein'

    let textToClean = text
    let ignoredSequences = 0
    if (text.includes('>')) {
      const fastaEntries = parseFasta(text).filter((e) => e.sequence.length > 0)
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
      setValue('codingSequence', '', { shouldValidate: false })
    }

    const charType = detectedIsProtein
      ? copy.charTypeNonAminoAcid
      : copy.charTypeNonNucleotide
    const parts: string[] = []
    if (ignoredSequences > 0)
      parts.push(copy.usedFirstSequence(ignoredSequences))
    if (removedHeaders > 0) parts.push(copy.headersStripped(removedHeaders))
    if (removedChars > 0) parts.push(copy.charsRemoved(removedChars, charType))

    if (parts.length > 0) {
      toast.info(copy.cleanedSummary(source, parts.join(', ')))
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text')
    const hasHeaders = text.includes('>')
    const letters = text.replace(/\s/g, '')
    const seqChars =
      letters.match(/[ACDEFGHIKLMNPQRSTUVWYacdefghiklmnpqrstuvwy*]/g)?.length ??
      0
    const looksLikeSequence =
      letters.length >= 6 && seqChars / letters.length > 0.8
    if (hasHeaders || looksLikeSequence) {
      e.preventDefault()
      applyCleanedSequence(text, copy.pasteSource)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const entries = parseFasta(text)

      if (entries.length > 0 && entries[0].header) {
        const currentName = getValues('name')
        if (!currentName) {
          setValue('name', entries[0].header.slice(0, 250))
        }
      }

      applyCleanedSequence(text, copy.fastaSource)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSequenceTypeChange = (newType: SequenceType) => {
    if (newType === sequenceType) return
    setValue('sequenceType', newType)
    clearErrors(['codingSequence', 'proteinSequence', 'species'])

    if (newType === 'protein') {
      if (species === 'none') {
        setValue('species', 'human', { shouldValidate: false })
      }
      const dna = (dnaValue ?? '').toUpperCase().replace(/U/g, 'T')
      if (dna.length >= 3) {
        const protein = translate(dna).replace(/\*+$/, '')
        setValue('proteinSequence', protein, { shouldValidate: false })
      }
    } else {
      setValue('codingSequence', '', { shouldValidate: false })
    }
  }

  const handleReverseTranslate = () => {
    const protein = (proteinValue ?? '').toUpperCase().replace(/\s/g, '')
    if (!protein) {
      toast.error(copy.reverseTranslateProteinRequired)
      return
    }
    if (!isSpecies(species)) {
      toast.error(copy.reverseTranslateSpeciesRequired)
      return
    }
    applyReverseTranslation(protein)
  }

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
          {/* The highlight layer sits behind a transparent textarea. FormControl
              wraps the textarea itself so the label, aria-invalid and the
              error description land on the field, not on this wrapper. */}
          <div className="relative min-h-[6.5rem]">
            {!isProtein && (
              <div
                ref={backdropRef}
                aria-hidden="true"
                className={cn(
                  sharedTextStyles,
                  // The field's fill lives here, behind the transparent
                  // textarea, so it doesn't tint the highlighted bases.
                  'pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-transparent bg-input/50 text-foreground',
                )}
              >
                {activeValue ? (
                  <SequenceHighlight sequence={activeValue} />
                ) : (
                  <span className="text-transparent">placeholder</span>
                )}
              </div>
            )}
            <FormControl>
              <textarea
                placeholder={
                  isProtein ? copy.placeholderProtein : copy.placeholderDna
                }
                rows={4}
                aria-required="true"
                {...field}
                onChange={field.onChange}
                ref={(el) => {
                  field.ref(el)
                  textareaRef.current = el
                }}
                onPaste={handlePaste}
                onScroll={syncScroll}
                className={cn(
                  sharedTextStyles,
                  // Same look as the Textarea primitive.
                  'relative flex w-full min-w-0 resize-y rounded-2xl border border-transparent caret-foreground transition-[color,box-shadow] duration-200 outline-none selection:bg-primary/30 placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
                  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
                  isProtein ? 'bg-input/50' : 'bg-transparent text-transparent',
                )}
              />
            </FormControl>
          </div>
          <FormMessage />
          {isProtein && (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={handleReverseTranslate}
            >
              {copy.reverseTranslateButton}
            </Button>
          )}
          {isProtein && isSpecies(species) && dnaValue && (
            <p className="text-sm text-muted-foreground">
              {copy.reverseTranslated(
                dnaValue.length.toLocaleString(),
                species,
              )}
            </p>
          )}
          {isProtein && !isSpecies(species) && length > 0 && (
            <p className="text-sm text-warning-soft">
              {copy.selectSpeciesHint}
            </p>
          )}
          {!isProtein && <SequenceDiagnostics />}
        </FormItem>
      )}
    />
  )
}
