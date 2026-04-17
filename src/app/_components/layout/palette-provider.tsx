'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  type PaletteValue,
} from '@/lib/palette'

type PaletteContextValue = {
  palette: PaletteValue
  setPalette: (value: PaletteValue) => void
}

const PaletteContext = React.createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
})

function PaletteBridge({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const value = React.useMemo<PaletteContextValue>(
    () => ({
      palette: (theme as PaletteValue) ?? DEFAULT_PALETTE,
      setPalette: (v) => setTheme(v),
    }),
    [theme, setTheme],
  )
  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  )
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-palette"
      storageKey={PALETTE_STORAGE_KEY}
      themes={PALETTES.map((p) => p.value)}
      defaultTheme={DEFAULT_PALETTE}
      enableSystem={false}
      disableTransitionOnChange
    >
      <PaletteBridge>{children}</PaletteBridge>
    </NextThemesProvider>
  )
}

export function usePalette() {
  return React.useContext(PaletteContext)
}
