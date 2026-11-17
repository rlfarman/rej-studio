'use client'

import { useSyncExternalStore } from 'react'
import { cn } from 'cn'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-lg bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none in-data-[slot=input-group]:bg-input in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
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

export { Kbd, KbdGroup, ModKey }
