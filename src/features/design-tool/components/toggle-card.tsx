'use client'
import { useFormContext, Controller } from 'react-hook-form'
import type { FieldPathByValue } from 'react-hook-form'
import { FormItem, FormControl } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { FieldHelp } from './field-help'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'

type BoolField = FieldPathByValue<FormValues, boolean>

interface ObjectiveToggleProperties {
  name: BoolField
  label: string
  description?: string
  badge?: string
  /** Plain-language explanation shown in a keyboard-reachable tooltip. */
  help?: string
  children?: React.ReactNode
}

/**
 * One objective row.
 *
 * Deliberately borderless: these sit inside a bordered section, and a border
 * per row made the form read as cards-inside-cards. Separation comes from the
 * parent's dividers, and the checked state from a subtle tint instead.
 */
export function ToggleCard({
  name,
  label,
  description,
  badge,
  help,
  children,
}: ObjectiveToggleProperties) {
  const { control } = useFormContext<FormValues>()
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const checked = field.value as boolean
        return (
          <FormItem className="gap-0">
            <div
              className={cn(
                'flex flex-row items-center gap-2.5 rounded-xl px-2 py-2.5 transition-colors',
                checked ? 'bg-primary/[0.04]' : 'hover:bg-muted/40',
              )}
            >
              <label
                htmlFor={name}
                className="flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-2.5"
              >
                <FormControl>
                  <Checkbox
                    id={name}
                    checked={checked}
                    onCheckedChange={field.onChange}
                    className="self-center"
                  />
                </FormControl>
                <div className="min-w-0 flex-1 space-y-0.5 self-center">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm leading-none font-medium">
                      {label}
                    </span>
                    {badge ? (
                      <Badge variant="outline" className="type-micro">
                        {badge}
                      </Badge>
                    ) : null}
                    {help ? <FieldHelp topic={label}>{help}</FieldHelp> : null}
                  </div>
                  {description ? (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {description}
                    </p>
                  ) : null}
                  {children}
                </div>
              </label>
            </div>
          </FormItem>
        )
      }}
    />
  )
}
