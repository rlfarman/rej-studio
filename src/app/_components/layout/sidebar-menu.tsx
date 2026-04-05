'use client'

import { useRef, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Download,
  Eraser,
  Monitor,
  Moon,
  MoreHorizontal,
  Sprout,
  Sun,
  Upload,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { exportUserData, importUserData } from '@/lib/data-transfer'
import { seedUserData, clearSeedUserData } from '@/app/_components/seed-data'
import { toast } from 'sonner'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function SidebarMenu() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecting client-side mount
    setMounted(true)
  }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { imported } = await importUserData(file)
      toast.success(
        `Imported ${imported} data ${imported === 1 ? 'category' : 'categories'}`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          {mounted && (
            <>
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={exportUserData}>
            <Download className="h-4 w-4" />
            Export data
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const { favorites, recents, jobs } = seedUserData()
              toast.success(
                `Seeded ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
              )
            }}
          >
            <Sprout className="h-4 w-4" />
            Seed data
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const { favorites, recents, jobs } = clearSeedUserData()
              const total = favorites + recents + jobs
              if (total === 0) {
                toast.info('No seed data to clear')
              } else {
                toast.success(
                  `Cleared ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
                )
              }
            }}
          >
            <Eraser className="h-4 w-4" />
            Clear seed data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
