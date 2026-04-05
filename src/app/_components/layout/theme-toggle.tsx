'use client'

import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEffect, useState } from 'react'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Standard next-themes pattern: defer rendering until client mount to avoid
  // hydration mismatch between server (no theme known) and client.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecting client-side mount
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2]
  const Icon = current.icon

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className="h-8 w-full text-sm">
        <SelectValue>
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {current.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {THEMES.map(({ value, label, icon: ItemIcon }) => (
          <SelectItem key={value} value={value}>
            <span className="flex items-center gap-2">
              <ItemIcon className="h-4 w-4" />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
