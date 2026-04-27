'use client'
import { useSyncExternalStore } from 'react'
import { GeneSearchShell } from '@/app/_components/gene-search-shell'
import { searchGenes } from '@/features/gene-search/api/genes'
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { commonCopy } from '@/copy/common'
import { cn } from '@/lib/utils'

const HIDE_AFTER = 80
const INTENT_THRESHOLD = 4

type ScrollState = { scrolled: boolean; isHidden: boolean }

const emptyState: ScrollState = { scrolled: false, isHidden: false }
let scrollState: ScrollState = emptyState
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function currentY(): number {
  const mainEl = document.getElementById('main-content')
  return Math.max(
    mainEl?.scrollTop ?? 0,
    window.scrollY,
    document.scrollingElement?.scrollTop ?? 0,
  )
}

function update(nextScrolled: boolean, nextHidden: boolean) {
  if (
    nextScrolled !== scrollState.scrolled ||
    nextHidden !== scrollState.isHidden
  ) {
    scrollState = { scrolled: nextScrolled, isHidden: nextHidden }
    notify()
  }
}

function applyIntent(directionDelta: number) {
  const y = currentY()
  const atTop = y <= 8
  const nextScrolled = y > 4
  let nextHidden = scrollState.isHidden
  if (atTop) nextHidden = false
  else if (directionDelta > INTENT_THRESHOLD && y > HIDE_AFTER)
    nextHidden = true
  else if (directionDelta < -INTENT_THRESHOLD) nextHidden = false
  update(nextScrolled, nextHidden)
}

let subscribed = false
let lastTouchY = 0
function ensureSubscription() {
  if (subscribed || typeof window === 'undefined') return
  subscribed = true

  // Scroll events (when they fire) — covers keyboard, programmatic, some touch.
  const onScroll = () => applyIntent(0)
  document.addEventListener('scroll', onScroll, {
    passive: true,
    capture: true,
  })
  window.addEventListener('scroll', onScroll, { passive: true })

  // Wheel events — always fire on mouse/trackpad intent even if no element scrolls.
  window.addEventListener(
    'wheel',
    (event: WheelEvent) => applyIntent(event.deltaY),
    { passive: true },
  )

  // Touch events — always fire on touch intent.
  window.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? 0
    },
    { passive: true },
  )
  window.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0
      const delta = lastTouchY - y // swipe up (scroll down) = positive delta
      lastTouchY = y
      applyIntent(delta)
    },
    { passive: true },
  )
}

function subscribe(listener: () => void) {
  ensureSubscription()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => scrollState
const getServerSnapshot = () => emptyState

function useMainScroll() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const { state } = useSidebar()
  const sidebarLabel =
    state === 'expanded' ? commonCopy.sidebar.close : commonCopy.sidebar.open
  const { scrolled, isHidden } = useMainScroll()

  const geneSymbolMatch = pathname.match(/\/genes\/([^/]+)/)
  const geneSymbol = geneSymbolMatch ? geneSymbolMatch[1] : undefined

  return (
    <header
      aria-hidden={isHidden || undefined}
      className={cn(
        'sticky top-0 z-10 flex items-center px-3 sm:px-4 md:px-6',
        'border-b transition-[height,margin-top,opacity,background-color,border-color] duration-200 ease-out motion-reduce:transition-none',
        scrolled
          ? 'bg-background/80 border-border/60 h-12 backdrop-blur'
          : 'bg-background h-15 border-transparent',
        isHidden && 'pointer-events-none -mt-12 opacity-0',
      )}
    >
      <div className="z-10 flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger size="lg" aria-label={sidebarLabel} />
          </TooltipTrigger>
          <TooltipContent>{sidebarLabel}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-1 justify-center">
        {!isHomePage && (
          <GeneSearchShell
            searchGenes={searchGenes}
            defaultQuery={geneSymbol}
            isDialog
          />
        )}
      </div>
    </header>
  )
}
