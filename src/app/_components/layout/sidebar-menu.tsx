'use client'

import { useRef, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Download,
  Eraser,
  GraduationCap,
  Monitor,
  Moon,
  Settings,
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
import { exportUserData, importUserData } from '@/lib/data-transfer'
import { seedUserData, clearSeedUserData } from '@/app/_components/seed-data'
import { toast } from 'sonner'
import {
  SidebarMenu as SidebarMenuPrimitive,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { useOnboarding } from '@/features/onboarding/stores/onboarding-store'
import { appCopy } from '@/lib/copy'

const THEMES = [
  { value: 'light', label: appCopy.settings.themes.light, icon: Sun },
  { value: 'dark', label: appCopy.settings.themes.dark, icon: Moon },
  { value: 'system', label: appCopy.settings.themes.system, icon: Monitor },
] as const

export function SidebarMenu() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resetAllTours = useOnboarding((s) => s.resetAllTours)
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecting client-side mount
    setMounted(true)
  }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { imported } = await importUserData(file)
      toast.success(appCopy.settings.importSuccess(imported))
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : appCopy.settings.importFailed,
      )
    }
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        aria-label={appCopy.settings.importAriaLabel}
        className="hidden"
        onChange={handleImport}
      />
      <SidebarMenuPrimitive>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton tooltip={appCopy.settings.label}>
                <Settings />
                <span>{appCopy.settings.label}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              {mounted && (
                <>
                  <DropdownMenuLabel>
                    {appCopy.settings.themeLabel}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={setTheme}
                  >
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
                {appCopy.settings.exportData}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {appCopy.settings.importData}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  resetAllTours()
                  if (isMobile) setOpenMobile(false)
                  toast.success(appCopy.settings.toursReset)
                }}
              >
                <GraduationCap className="h-4 w-4" />
                {appCopy.settings.restartTours}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const { favorites, recents, jobs } = seedUserData()
                  toast.success(
                    appCopy.settings.seedSuccess(favorites, recents, jobs),
                  )
                }}
              >
                <Sprout className="h-4 w-4" />
                {appCopy.settings.seedData}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const { favorites, recents, jobs } = clearSeedUserData()
                  const total = favorites + recents + jobs
                  if (total === 0) {
                    toast.info(appCopy.settings.noSeedData)
                  } else {
                    toast.success(
                      appCopy.settings.clearSuccess(favorites, recents, jobs),
                    )
                  }
                }}
              >
                <Eraser className="h-4 w-4" />
                {appCopy.settings.clearSeedData}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenuPrimitive>
    </>
  )
}
