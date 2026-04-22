'use client'
import { useFormContext, Controller } from 'react-hook-form'
import type { Path } from 'react-hook-form'
import { FormItem, FormControl } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { HelpLink } from '@/components/ui/help-link'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'

type BoolField = {
  [K in Path<FormValues>]: FormValues[K] extends boolean ? K : never
}[Path<FormValues>]

interface ToggleCardProperties {
  name: BoolField
  label: string
  description: string
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
                'flex flex-row items-start gap-1 border p-3 transition-colors',
                checked
                  ? 'border-primary/40 bg-primary/5'
                  : 'hover:bg-muted/50',
                activeChildren && checked
                  ? 'rounded-t-lg border-b-0'
                  : 'rounded-lg',
              )}
            >
              <label
                htmlFor={name}
                className="flex flex-1 cursor-pointer flex-row items-start gap-3"
              >
                <FormControl>
                  <Checkbox
                    id={name}
                    checked={checked}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm leading-none font-medium">
                      {label}
                    </span>
                    {badge ? (
                      <Badge variant="outline" className="text-[10px]">
                        {badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-[13px] leading-snug">
                    {description}
                  </p>
                  {children}
                </div>
              </label>
              {helpHref && (
                <HelpLink
                  href={helpHref}
                  topic={label}
                  className="-mt-1 -mr-1"
                />
              )}
            </div>
            {activeChildren && checked && (
              <div
                className={cn(
                  'border-primary/40 bg-primary/5 rounded-b-lg border border-t-0 px-3 pt-3 pb-3',
                  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200',
                )}
              >
                {activeChildren}
              </div>
            )}
          </FormItem>
        )
      }}
    />
  )
}
