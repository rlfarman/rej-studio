'use client'
import { useEffect, useState } from 'react'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
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
const DELTA_THRESHOLD = 6

function useMainScroll() {
  const [scrolled, setScrolled] = useState(false)
  const [isHidden, setHidden] = useState(false)

  useEffect(() => {
    const el = document.getElementById('main-content')
    if (!el) return
    let lastY = el.scrollTop
    const onScroll = () => {
      const y = el.scrollTop
      const delta = y - lastY
      const atTop = y <= 8
      const atBottom = y + el.clientHeight >= el.scrollHeight - 8
      setScrolled(y > 4)
      if (atTop || atBottom) {
        setHidden(false)
      } else if (delta > DELTA_THRESHOLD && y > HIDE_AFTER) {
        setHidden(true)
      } else if (delta < -DELTA_THRESHOLD) {
        setHidden(false)
      }
      lastY = y
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return { scrolled, isHidden }
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
        'sticky top-0 z-10 flex items-center px-3 will-change-transform md:px-6',
        'border-b transition-[height,transform,opacity,background-color,border-color] duration-200 ease-out motion-reduce:transition-none',
        scrolled
          ? 'bg-background/80 border-border/60 h-12 backdrop-blur'
          : 'bg-background h-15 border-transparent',
        isHidden &&
          'pointer-events-none -translate-y-full opacity-0 md:pointer-events-auto md:translate-y-0 md:opacity-100',
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
          <GeneSearch
            searchGenes={searchGenes}
            defaultQuery={geneSymbol}
            isDialog
          />
        )}
      </div>
    </header>
  )
}
