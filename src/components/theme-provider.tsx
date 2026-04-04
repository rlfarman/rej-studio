'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { LazyMotion, domAnimation } from 'motion/react'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </NextThemesProvider>
  )
}
