'use client'
import { useFormContext, Controller } from 'react-hook-form'
import type { FieldPathByValue } from 'react-hook-form'
import { FormItem, FormControl } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'

type BoolField = FieldPathByValue<FormValues, boolean>

interface ToggleCardProperties {
  name: BoolField
  label: string
  description: string
  badge?: string
  children?: React.ReactNode
}

export function ToggleCard({
  name,
  label,
  description,
  badge,
  children,
}: ToggleCardProperties) {
  const { control } = useFormContext<FormValues>()
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const checked = field.value as boolean
        return (
          <FormItem className="space-y-0">
            <label
              htmlFor={name}
              className={cn(
                'flex cursor-pointer flex-row items-start gap-3 rounded-lg border p-3 transition-colors',
                checked
                  ? 'border-primary/40 bg-primary/5'
                  : 'hover:bg-muted/50',
              )}
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
          </FormItem>
        )
      }}
    />
  )
}
