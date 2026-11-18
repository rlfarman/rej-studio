import { useLayoutEffect, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Upload, Dna, Eraser, FlaskConical } from 'lucide-react'
import { FormValues, type SequenceType } from '../types/form-schema'
import { SequenceDiagnostics } from './sequence-diagnostics'
import { SequenceHighlight } from './sequence-highlight'
import { cn } from '@/lib/utils'
import { cleanSequence, parseFasta } from '@/lib/bio/fasta'
import {
  designNameFromFastaHeader,
  detectSequenceType,
  hasInvalidChars,
} from '@/lib/bio/sequence-utils'
import { toast } from '@/lib/toast'
import { isSpecies } from '@/lib/bio/species'
import { pickDefaultSplitPoints } from '../utils/default-split-point'
import { rescaleSplitPoints, type SplitAnchor } from '../utils/split-points'
import { useReverseTranslation } from '../hooks/use-reverse-translation'
import { translate } from '@/lib/bio/genetic-code'
import { designToolCopy } from '../copy'

const copy = designToolCopy.sequenceInput

const SEQUENCE_TYPE_OPTIONS: {
  value: SequenceType
  label: string
  icon: typeof Dna
}[] = [
  { value: 'dna', label: copy.typeDna, icon: Dna },
  { value: 'protein', label: copy.typeProtein, icon: FlaskConical },
]

function SequenceTypeToggle({
  value,
  onChange,
}: {
  value: SequenceType
  onChange: (v: SequenceType) => void
}) {
  // A radio group is one tab stop and the arrow keys move within it, so only
  // the checked segment is tabbable and selection follows focus.
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (index: number) => {
    const option = SEQUENCE_TYPE_OPTIONS[index]
    if (!option) return
    onChange(option.value)
    buttonRefs.current[index]?.focus()
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const count = SEQUENCE_TYPE_OPTIONS.length
    let target: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = (index + 1) % count
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = (index - 1 + count) % count
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = count - 1
        break
      default:
        return
    }
    event.preventDefault()
    select(target)
  }

  return (
    <div
      role="radiogroup"
      aria-label={copy.typeToggleAria}
      className="inline-flex gap-0.5 rounded-2xl bg-muted p-0.5"
    >
      {SEQUENCE_TYPE_OPTIONS.map((opt, index) => {
        const Icon = opt.icon
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            onClick={() => onChange(opt.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-sm font-medium transition-colors',
              // The ring falls on the muted track, where the shared /30 is
              // hard to see against the filled active segment beside it.
              'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
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

  // In protein mode the DNA comes from the optimizer worker, which owns the
  // codon tables. It arrives after a debounce, so the field below reports
  // "translating" rather than showing the previous protein's DNA.
  const reverseTranslation = useReverseTranslation()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // The textarea is uncontrolled: the browser owns its text while typing,
  // and only writes from elsewhere (paste cleaning, FASTA upload, the
  // DNA/protein toggle, reverse translation, draft restore, reset) are pushed
  // into it here.
  //
  // Controlled, it dropped keystrokes. Typing re-renders the split-point
  // editor, which wrote derived values back into the form from effects: the
  // selected WGGW sites (now resolved on submit from the picks, see
  // utils/wggw-selection.ts) and still the clamped split points
  // (splice-slider-context.tsx, the effect calling onPositionsChange). When
  // such a write landed between a keystroke and its render, React ended the
  // input event by
  // restoring the field to the value it had last rendered, and the next key
  // was typed onto the shorter text. Uncontrolled, there is no rendered value
  // to restore to.
  //
  // `typedRef` holds what the field itself has emitted since it last matched
  // the form. A form value found there is this field's own keystroke catching
  // up, possibly behind newer ones, and must not be written back over them.
  const typedRef = useRef(new Set<string>())
  // Where the split points were last rescaled to (see rescaleSplitPoints).
  const splitAnchorRef = useRef<SplitAnchor | null>(null)

  // Typing moves the split points with the sequence, here in the change
  // handler rather than in an effect after the render, so a keystroke is one
  // batched form update. Writes that set a sequence together with its split
  // points (paste, upload, reverse translation, restores) bypass this.
  const rescaleSplitPointsForTyping = (nextLength: number) => {
    const positions = getValues('spliceJunctionPositions') ?? []
    const anchor = rescaleSplitPoints(
      positions,
      getValues('codingSequence')?.length ?? 0,
      nextLength,
      splitAnchorRef.current,
    )
    splitAnchorRef.current = anchor
    if (anchor.positions.some((p, i) => p !== positions[i])) {
      setValue('spliceJunctionPositions', anchor.positions)
    }
  }
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const next = activeValue ?? ''
    if (el.value !== next && !typedRef.current.has(next)) {
      el.value = next
    }
    if (el.value === next) typedRef.current.clear()
  }, [activeValue])

  const syncScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
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
      // A new sequence starts its WGGW picks over: the old ones name sites
      // that may not be in it.
      setValue('wggwSitePicks', [], { shouldValidate: false })
      setValue('wggwRewritePicks', [], { shouldValidate: false })
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
          // The raw header becomes the design's name in history, in the cloud
          // list and in the exported report, so a database header is reduced
          // to the part a person would have typed.
          const name = designNameFromFastaHeader(entries[0].header)
          if (name) setValue('name', name)
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

  // The DNA is already there (the hook keeps it in step); this button is the
  // step the user takes once they are happy with it — continue in DNA mode,
  // where the sequence can be inspected and the split moved.
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
    if (reverseTranslation.error) {
      toast.error(copy.reverseTranslateFailed(reverseTranslation.error))
      return
    }
    if (reverseTranslation.pending || !dnaValue) return
    setValue('sequenceType', 'dna', { shouldValidate: false })
  }

  const activeField = isProtein ? 'proteinSequence' : 'codingSequence'
  const fileAccept = isProtein ? '.fasta,.fa,.faa,.txt' : '.fasta,.fa,.fna,.txt'

  const sharedTextStyles =
    'px-3 py-2 font-mono text-sm leading-normal break-all whitespace-pre-wrap'

  return (
    <FormField
      name={activeField}
      control={control}
      render={({ field, fieldState }) => (
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
            {/* Pasting junk cleans itself and says what it changed; typing
                the same characters only gets a blocking error with nothing to
                press. This offers the same repair, through the same code and
                the same summary toast.

                DNA only: the nucleotide test would offer to strip valid
                residues from protein input.

                `hasInvalidChars`, not `findInvalidChars`: this runs on every
                render while someone types, and only the yes/no is needed. */}
            {!isProtein && hasInvalidChars(activeValue ?? '') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-3 text-xs"
                onClick={() =>
                  applyCleanedSequence(activeValue ?? '', copy.cleanSequence)
                }
                aria-label={copy.cleanAria}
              >
                <Eraser className="size-3.5" />
                {copy.cleanSequence}
              </Button>
            )}
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
                name={field.name}
                disabled={field.disabled}
                onBlur={field.onBlur}
                onChange={(event) => {
                  typedRef.current.add(event.target.value)
                  if (!isProtein) {
                    rescaleSplitPointsForTyping(event.target.value.length)
                  }
                  field.onChange(event)
                }}
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
                  // `break-all` keeps a pasted sequence aligned with the
                  // highlight layer behind it, but it also chops the
                  // placeholder's prose mid-word on a narrow screen.
                  'placeholder:break-normal',
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
              // The FormItem is a grid, so without this a small button
              // stretches the full card width and reads like a banner.
              className="mt-2 justify-self-start"
              disabled={reverseTranslation.pending}
              aria-busy={reverseTranslation.pending}
              onClick={handleReverseTranslate}
            >
              {reverseTranslation.pending
                ? copy.reverseTranslatePending
                : copy.reverseTranslateButton}
            </Button>
          )}
          {isProtein && isSpecies(species) && reverseTranslation.pending && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {copy.reverseTranslatePending}
            </p>
          )}
          {/* Only when the field itself is valid: with "MAXKZ*BB" the schema
              already says which letters are allowed, and the optimizer's
              "Invalid amino acid character(s)" beside it reads as a tool
              failure for what is really input the form has refused. */}
          {isProtein &&
            !fieldState.error &&
            reverseTranslation.error !== null && (
              <p aria-live="polite" className="text-sm text-danger-soft">
                {copy.reverseTranslateFailed(reverseTranslation.error)}
              </p>
            )}
          {isProtein &&
            isSpecies(species) &&
            !reverseTranslation.pending &&
            dnaValue && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
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
