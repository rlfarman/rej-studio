'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useSpeciesStore } from '@/stores/species-store'
import { setUserProperties } from '@/lib/analytics'

/**
 * Syncs user/session properties to the GTM dataLayer whenever they change.
 * Renders nothing — mount anywhere inside `<ThemeProvider>`.
 */
export function AnalyticsProperties() {
  const species = useSpeciesStore((s) => s.species)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setUserProperties({ species, theme: resolvedTheme })
  }, [species, resolvedTheme])

  return null
}
