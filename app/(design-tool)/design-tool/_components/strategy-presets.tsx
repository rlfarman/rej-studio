'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { PRESETS, PRESET_KEYS } from '@/design-tool/lib/presets'
import type { FormValues } from './form-schema'

export function StrategyPresets() {
  const { getValues, reset } = useFormContext<FormValues>()
  const [activePreset, setActivePreset] = useState<string | null>('balanced')

  const applyPreset = (key: string) => {
    const preset = PRESETS[key]
    if (!preset) return

    if (key === 'expert') {
      setActivePreset('expert')
      return
    }

    const current = getValues()
    reset({ ...current, ...preset.values })
    setActivePreset(key)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Strategy preset</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PRESET_KEYS.map((key) => {
          const preset = PRESETS[key]
          const isActive = activePreset === key

          return (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={cn(
                'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                isActive
                  ? 'border-primary bg-primary/5 ring-primary/20 ring-1'
                  : 'hover:bg-muted/50',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  isActive && 'text-primary',
                )}
              >
                {preset.label}
              </span>
              <span className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-tight">
                {preset.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
