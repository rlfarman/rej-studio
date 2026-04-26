'use client'
import { useFormContext, Controller } from 'react-hook-form'
import type { FieldPathByValue } from 'react-hook-form'
import { FormItem, FormControl } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { HelpLink } from '@/components/ui/help-link'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'

type BoolField = FieldPathByValue<FormValues, boolean>

interface ToggleCardProperties {
  name: BoolField
  label: string
  description?: string
  badge?: string
  /** Docs URL shown on a small "?" icon at the edge of the card. */
  helpHref?: string
  children?: React.ReactNode
  /** Rendered below the description only when the toggle is checked. */
  activeChildren?: React.ReactNode
}

export function ToggleCard({
  name,
  label,
  description,
  badge,
  helpHref,
  children,
  activeChildren,
}: ToggleCardProperties) {
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
                'flex flex-row items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                checked
                  ? 'border-primary/40 bg-primary/5'
                  : 'hover:bg-muted/50',
              )}
            >
              <label
                htmlFor={name}
                className="flex flex-1 cursor-pointer flex-row items-center gap-2.5"
              >
                <FormControl>
                  <Checkbox
                    id={name}
                    checked={checked}
                    onCheckedChange={field.onChange}
                    className="self-center"
                  />
                </FormControl>
                <div className="flex-1 space-y-0.5 self-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm leading-none font-medium">
                      {label}
                    </span>
                    {badge ? (
                      <Badge variant="outline" className="type-micro">
                        {badge}
                      </Badge>
                    ) : null}
                  </div>
                  {description ? (
                    <p className="text-muted-foreground text-xs leading-snug">
                      {description}
                    </p>
                  ) : null}
                  {children}
                </div>
              </label>
              {activeChildren ? (
                <div
                  className={cn(
                    'min-w-fit self-center pl-1.5 transition-opacity',
                    !checked && 'opacity-50',
                  )}
                  aria-disabled={!checked}
                >
                  {activeChildren}
                </div>
              ) : null}
              {helpHref && (
                <HelpLink
                  href={helpHref}
                  topic={label}
                  className="-mt-1 -mr-1"
                />
              )}
            </div>
          </FormItem>
        )
      }}
    />
  )
}
