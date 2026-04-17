'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'

const copy = designToolCopy.weights

// Semantic tiers mapped to numeric weights. The algorithm takes a 0-100
// weight, but in practice presets use 1-10 and useful range tops out ~50.
// Surfacing these as named tiers matches the language in the help text
// ("1 = gentle, 10 = strong, 50+ = aggressive") and removes the guesswork
// of picking an arbitrary number.
const TIERS = [
  { label: copy.tiers.gentle, value: 1 },
  { label: copy.tiers.moderate, value: 3 },
  { label: copy.tiers.strong, value: 10 },
  { label: copy.tiers.aggressive, value: 50 },
] as const

function nearestTierIndex(value: number): number {
  let bestIndex = 0
  let bestDelta = Math.abs(value - TIERS[0].value)
  for (let i = 1; i < TIERS.length; i++) {
    const delta = Math.abs(value - TIERS[i].value)
    if (delta < bestDelta) {
      bestDelta = delta
      bestIndex = i
    }
  }
  return bestIndex
}

interface WeightFieldProperties {
  name: keyof FormValues
  label: string
  description: string
  disabled: boolean
  disabledHint?: React.ReactNode
}

function WeightField({
  name,
  label,
  description,
  disabled,
  disabledHint,
}: WeightFieldProperties) {
  const { control } = useFormContext<FormValues>()

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => {
        const numericValue =
          typeof field.value === 'number' ? field.value : TIERS[0].value
        const activeIndex = nearestTierIndex(numericValue)
        const isCustom = TIERS[activeIndex].value !== numericValue

        return (
          <FormItem>
            <div className="flex items-baseline justify-between gap-2">
              <FormLabel
                className={disabled ? 'text-muted-foreground' : undefined}
              >
                {label}
              </FormLabel>
              {!disabled && (
                <span
                  className={cn(
                    'text-xs',
                    isCustom ? 'text-muted-foreground' : 'text-primary',
                  )}
                >
                  {isCustom
                    ? `~ ${TIERS[activeIndex].label}`
                    : TIERS[activeIndex].label}
                </span>
              )}
            </div>
            <FormControl>
              <div className="flex flex-wrap items-stretch gap-2">
                <div
                  role="radiogroup"
                  aria-label={copy.tierAria(label)}
                  className={cn(
                    'bg-muted/40 grid flex-1 grid-cols-2 gap-1 rounded-md p-1 sm:grid-cols-4',
                    'min-w-0',
                    disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  {TIERS.map((tier, index) => {
                    const isActive = !disabled && index === activeIndex
                    return (
                      <button
                        key={tier.label}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        disabled={disabled}
                        onClick={() => field.onChange(tier.value)}
                        className={cn(
                          'focus-visible:ring-ring rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                          isActive
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {tier.label}
                      </button>
                    )
                  })}
                </div>
                <Input
                  type="number"
                  aria-label={copy.exactAria(label)}
                  value={numericValue}
                  onChange={(e) => {
                    const next = e.target.value
                    field.onChange(next === '' ? 0 : Number(next))
                  }}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={disabled}
                  className="h-auto w-20 text-center tabular-nums"
                />
              </div>
            </FormControl>
            <FormDescription>
              {disabled ? disabledHint : description}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

function EnableLink({
  onClick,
  children,
  suffix,
}: {
  onClick: () => void
  children: React.ReactNode
  suffix: string
}) {
  return (
    <>
      <button
        type="button"
        className="text-primary underline-offset-2 hover:underline"
        onClick={onClick}
      >
        {children}
      </button>{' '}
      {suffix}
    </>
  )
}

export function CodonOptimizeWeight() {
  const { watch, setValue } = useFormContext<FormValues>()
  const disabled = watch('species') === 'none'

  return (
    <WeightField
      name="codonOptimizeWeight"
      label={copy.codonOptimize.label}
      description={copy.codonOptimize.description}
      disabled={disabled}
      disabledHint={
        <EnableLink
          onClick={() => setValue('species', 'human')}
          suffix={copy.codonOptimize.enableSuffix}
        >
          {copy.codonOptimize.enableLinkText}
        </EnableLink>
      }
    />
  )
}

export function RemoveCrypticSpliceSitesWeight() {
  const { watch, setValue } = useFormContext<FormValues>()
  const disabled = !watch('removeCrypticSpliceSites')

  return (
    <WeightField
      name="removeCrypticSpliceSitesWeight"
      label={copy.removeSplice.label}
      description={copy.removeSplice.description}
      disabled={disabled}
      disabledHint={
        <EnableLink
          onClick={() => setValue('removeCrypticSpliceSites', true)}
          suffix={copy.removeSplice.enableSuffix}
        >
          {copy.removeSplice.enableLinkText}
        </EnableLink>
      }
    />
  )
}

export function MinimizeCpGsWeight() {
  const { watch, setValue } = useFormContext<FormValues>()
  const disabled = !watch('minimizeCpgs')

  return (
    <WeightField
      name="minimizeCpgsWeight"
      label={copy.minimizeCpG.label}
      description={copy.minimizeCpG.description}
      disabled={disabled}
      disabledHint={
        <EnableLink
          onClick={() => setValue('minimizeCpgs', true)}
          suffix={copy.minimizeCpG.enableSuffix}
        >
          {copy.minimizeCpG.enableLinkText}
        </EnableLink>
      }
    />
  )
}

export function ReduceKmerComplexityWeight() {
  const { watch, setValue } = useFormContext<FormValues>()
  const disabled = !watch('reduceKmerComplexity')

  return (
    <WeightField
      name="reduceKmerComplexityWeight"
      label={copy.reduceKmer.label}
      description={copy.reduceKmer.description}
      disabled={disabled}
      disabledHint={
        <EnableLink
          onClick={() => setValue('reduceKmerComplexity', true)}
          suffix={copy.reduceKmer.enableSuffix}
        >
          {copy.reduceKmer.enableLinkText}
        </EnableLink>
      }
    />
  )
}
