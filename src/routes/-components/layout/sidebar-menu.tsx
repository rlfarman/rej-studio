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
import { exportUserData, importUserData } from '@/routes/-components/user-data'
import { seedUserData, clearSeedUserData } from '@/routes/-components/seed-data'
import { toast } from 'sonner'
import {
  SidebarMenu as SidebarMenuPrimitive,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecting client-side mount
    setMounted(true)
  }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    // Clear it so picking the same file again still fires onChange.
    input.value = ''
    if (!file) return

    const importCopy = errorsCopy.importUserData
    try {
      const result = await importUserData(file)
      if (!result.ok) {
        toast.error(
          result.reason === 'too-large'
            ? importCopy.tooLarge
            : importCopy.invalid,
        )
        return
      }
      const { favorites, recents, jobs } = result.added
      if (favorites + recents + jobs === 0) {
        toast.info(importCopy.nothingNew)
      } else {
        toast.success(importCopy.success(favorites, recents, jobs))
      }
    } catch {
      // e.g. localStorage is full or blocked.
      toast.error(importCopy.failure)
    }
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
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton tooltip={menuCopy.settings} />}
            >
              <Settings />
              <span>{menuCopy.settings}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              {mounted && (
                <>
                  {/* Base UI requires a menu label inside its group; this also
                      labels the radio group for screen readers. */}
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={setTheme}
                  >
                    <DropdownMenuLabel>
                      {menuCopy.theme.label}
                    </DropdownMenuLabel>
                    {THEMES.map(({ value, label, icon: Icon }) => (
                      <DropdownMenuRadioItem key={value} value={value}>
                        <Icon className="text-foreground h-4 w-4" />
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => void exportUserData()}>
                <Download className="text-foreground h-4 w-4" />
                {menuCopy.exportData}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="text-foreground h-4 w-4" />
                {menuCopy.importData}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const { favorites, recents, jobs } = seedUserData()
                  toast.success(menuCopy.seedResult(favorites, recents, jobs))
                }}
              >
                <Sprout className="text-foreground h-4 w-4" />
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
                <Eraser className="text-foreground h-4 w-4" />
                {menuCopy.clearSeedData}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenuPrimitive>
    </>
  )
}
