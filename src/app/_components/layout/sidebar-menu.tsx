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
import { commonCopy } from '@/copy/common'
import { errorsCopy } from '@/copy/errors'

const menuCopy = commonCopy.menu

const THEMES = [
  { value: 'light', label: menuCopy.theme.light, icon: Sun },
  { value: 'dark', label: menuCopy.theme.dark, icon: Moon },
  { value: 'system', label: menuCopy.theme.system, icon: Monitor },
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
      toast.success(errorsCopy.importUserData.success(imported))
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : errorsCopy.importUserData.failure,
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
        aria-label={menuCopy.importUserData}
        className="hidden"
        onChange={handleImport}
      />
      <SidebarMenuPrimitive>
        <SidebarMenuItem data-tour="nav-settings">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton tooltip={menuCopy.settings}>
                <Settings />
                <span>{menuCopy.settings}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              {mounted && (
                <>
                  <DropdownMenuLabel>{menuCopy.theme.label}</DropdownMenuLabel>
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
                {menuCopy.exportData}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {menuCopy.importData}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  resetAllTours()
                  if (isMobile) setOpenMobile(false)
                  toast.success(menuCopy.toursReset)
                }}
              >
                <GraduationCap className="h-4 w-4" />
                {menuCopy.restartTours}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const { favorites, recents, jobs } = seedUserData()
                  toast.success(menuCopy.seedResult(favorites, recents, jobs))
                }}
              >
                <Sprout className="h-4 w-4" />
                {menuCopy.seedData}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const { favorites, recents, jobs } = clearSeedUserData()
                  const total = favorites + recents + jobs
                  if (total === 0) {
                    toast.info(menuCopy.noSeedToClear)
                  } else {
                    toast.success(
                      menuCopy.seedCleared(favorites, recents, jobs),
                    )
                  }
                }}
              >
                <Eraser className="h-4 w-4" />
                {menuCopy.clearSeedData}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenuPrimitive>
    </>
  )
}
