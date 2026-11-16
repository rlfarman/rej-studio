'use client'

import * as React from 'react'
import { useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'

/** A keycap. Compose multiple keys inside one cap, e.g. `<Kbd><ModKey /> K</Kbd>`. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted text-muted-foreground type-nano pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded border px-1.5 font-sans font-medium select-none',
        className,
      )}
      {...props}
    />
  )
}

const subscribeNever = () => () => {}

function getIsApplePlatform(): boolean {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platform = nav.userAgentData?.platform ?? nav.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform || nav.userAgent)
}

/**
 * The platform's shortcut modifier: ⌘ on Apple devices, Ctrl elsewhere.
 * Renders "Ctrl" during SSR and hydration, then the client value.
 */
function ModKey() {
  const isApple = useSyncExternalStore(
    subscribeNever,
    getIsApplePlatform,
    () => false,
  )
  return <span>{isApple ? '⌘' : 'Ctrl'}</span>
}

export { Kbd, ModKey }
