'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

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

  const isDark = theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" />
          Light mode
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          Dark mode
        </>
      )}
    </Button>
  )
}
