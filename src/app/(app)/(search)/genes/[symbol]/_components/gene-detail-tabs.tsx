'use client'
import { startTransition, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Table2, Map as MapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GeneMap } from '@/features/gene-map/components/gene-map'
import { geneMapCopy } from '@/features/gene-map/copy'
import type { GeneMapIsoform } from '@/features/gene-map/types'

interface Props {
  isoforms: GeneMapIsoform[]
  initialIsoformId?: string
  children: React.ReactNode
}

type Tab = 'isoforms' | 'map'

export function GeneDetailTabs({
  isoforms,
  initialIsoformId,
  children,
}: Props) {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab: Tab = sp.get('tab') === 'map' ? 'map' : 'isoforms'
  const activeIsoformId = sp.get('isoform') ?? initialIsoformId

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(sp?.toString() ?? '')
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      const qs = next.toString()
      startTransition(() => {
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
      })
    },
    [sp, pathname, router],
  )

  const setTab = (tab: Tab) => {
    setParams({ tab: tab === 'map' ? 'map' : null })
  }

  const setIsoform = (id: string) => {
    setParams({ isoform: id, tab: 'map' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Gene view"
        className="bg-muted/40 inline-flex w-fit rounded-lg border p-0.5"
      >
        <TabButton
          label="Isoforms"
          active={activeTab === 'isoforms'}
          onClick={() => setTab('isoforms')}
          icon={<Table2 className="size-3.5" />}
        />
        <TabButton
          label={geneMapCopy.tabLabel}
          active={activeTab === 'map'}
          onClick={() => setTab('map')}
          icon={<MapIcon className="size-3.5" />}
          badge="New"
        />
      </div>

      {activeTab === 'map' ? (
        <GeneMap
          isoforms={isoforms}
          initialIsoformId={activeIsoformId}
          onIsoformChange={setIsoform}
        />
      ) : (
        children
      )}
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
  icon,
  badge,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  badge?: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
      {badge && (
        <span className="bg-primary/15 text-primary ml-1 rounded-sm px-1 text-[9px] font-semibold tracking-wider uppercase">
          {badge}
        </span>
      )}
    </button>
  )
}
