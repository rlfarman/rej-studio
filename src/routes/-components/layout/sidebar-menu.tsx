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
// The data tools load when used: import validates a whole backup with zod,
// which doesn't belong in every page. Seeding is development-only.
const loadUserData = () => import('@/routes/-components/user-data')
const loadSeedData = () => import('@/routes/-components/seed-data')
import { toast } from '@/lib/toast'
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
      const { importUserData } = await loadUserData()
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
                        <Icon className="h-4 w-4 text-foreground" />
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() =>
                  void loadUserData().then(({ exportUserData }) =>
                    exportUserData(),
                  )
                }
              >
                <Download className="h-4 w-4 text-foreground" />
                {menuCopy.exportData}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 text-foreground" />
                {menuCopy.importData}
              </DropdownMenuItem>
              {import.meta.env.DEV && <SeedDataItems />}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenuPrimitive>
    </>
  )
}

/**
 * Demo data for developing and demoing the app (sample favorites, recents
 * and design jobs). Development builds only: the code and its sample
 * sequences are left out of production entirely.
 */
function SeedDataItems() {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          void loadSeedData().then(({ seedUserData }) => {
            const { favorites, recents, jobs } = seedUserData()
            toast.success(menuCopy.seedResult(favorites, recents, jobs))
          })
        }
      >
        <Sprout className="h-4 w-4 text-foreground" />
        {menuCopy.seedData}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() =>
          void loadSeedData().then(({ clearSeedUserData }) => {
            const { favorites, recents, jobs } = clearSeedUserData()
            const total = favorites + recents + jobs
            if (total === 0) {
              toast.info(menuCopy.noSeedToClear)
            } else {
              toast.success(menuCopy.seedCleared(favorites, recents, jobs))
            }
          })
        }
      >
        <Eraser className="h-4 w-4 text-foreground" />
        {menuCopy.clearSeedData}
      </DropdownMenuItem>
    </>
  )
}
