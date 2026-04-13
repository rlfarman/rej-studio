'use client'

import { useRef, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Download,
  Eraser,
  Monitor,
  Moon,
  Settings,
  Sprout,
  Sun,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { exportUserData, importUserData } from '@/lib/data-transfer'
import { seedUserData, clearSeedUserData } from '@/app/_components/seed-data'
import { toast } from 'sonner'
import {
  SidebarMenu as SidebarMenuPrimitive,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function SidebarMenu() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
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
        aria-label="Import user data"
        className="hidden"
        onChange={handleImport}
      />
      <SidebarMenuPrimitive>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => setOpen(true)} tooltip="Settings">
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenuPrimitive>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Customize your experience.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 px-4">
            {mounted && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">Theme</h3>
                <RadioGroup
                  value={theme}
                  onValueChange={setTheme}
                  className="flex flex-col gap-2"
                >
                  {THEMES.map(({ value, label, icon: Icon }) => (
                    <div key={value} className="flex items-center gap-3">
                      <RadioGroupItem value={value} id={`theme-${value}`} />
                      <Label
                        htmlFor={`theme-${value}`}
                        className="flex items-center gap-2 font-normal"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Data</h3>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={exportUserData}
              >
                <Download className="h-4 w-4" />
                Export data
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Import data
              </Button>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Developer</h3>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  const { favorites, recents, jobs } = seedUserData()
                  toast.success(
                    `Seeded ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
                  )
                }}
              >
                <Sprout className="h-4 w-4" />
                Seed data
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
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
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
