'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Minus, Plus, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'
import type { GeneMapPayload } from '../api/types'
import { GeneMapCanvas, type LayersState } from './gene-map-canvas'
import { Minimap } from './minimap'
import { copy } from '../copy'

interface Props {
  payload: GeneMapPayload
}

export function GeneMap({ payload }: Props) {
  const [layers, setLayers] = useState<LayersState>({
    cpg: true,
    suit: false,
    gc: false,
    restriction: true,
  })
  const [status, setStatus] = useState({
    startBase: 0,
    endBase: payload.isoform.codingSequenceLength,
    bpp: payload.isoform.codingSequenceLength / 800,
    lod: 'far' as 'far' | 'mid' | 'near',
  })
  const cameraRef = useRef<{
    zoomAround: (px: number, factor: number) => void
    fit: () => void
    panBy: (dx: number) => void
  } | null>(null)

  const toggle = useCallback((k: keyof LayersState) => {
    setLayers((s) => ({ ...s, [k]: !s[k] }))
  }, [])

  const zoom = (factor: number) => cameraRef.current?.zoomAround(400, factor)

  return (
    <div className="bg-background fixed inset-0 z-40 flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`/genes/${payload.gene.symbol}?isoform=${payload.isoform.id}`}
            >
              <ArrowLeft className="size-4" />
              {copy.backToGene(payload.gene.symbol)}
            </Link>
          </Button>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-lg font-bold tracking-tight">
              {payload.gene.symbol}
            </span>
            <span className="text-muted-foreground text-xs">
              {payload.isoform.id}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {copy.status.bases(payload.isoform.codingSequenceLength)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-white/5 p-1">
            <Toggle
              size="sm"
              pressed={layers.cpg}
              onPressedChange={() => toggle('cpg')}
              aria-label={copy.layers.cpg}
            >
              CpG
            </Toggle>
            <Toggle
              size="sm"
              pressed={layers.restriction}
              onPressedChange={() => toggle('restriction')}
              aria-label={copy.layers.restriction}
            >
              RE
            </Toggle>
            <Toggle
              size="sm"
              pressed={layers.gc}
              onPressedChange={() => toggle('gc')}
              aria-label={copy.layers.gc}
            >
              GC
            </Toggle>
            <Toggle
              size="sm"
              pressed={layers.suit}
              onPressedChange={() => toggle('suit')}
              aria-label={copy.layers.suitability}
            >
              Suit
            </Toggle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => zoom(1.25)}
              aria-label={copy.zoom.out}
            >
              <Minus className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => zoom(0.8)}
              aria-label={copy.zoom.in}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => cameraRef.current?.fit()}
              aria-label={copy.zoom.fit}
            >
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="relative flex-1">
        <GeneMapCanvas
          payload={payload}
          layers={layers}
          onStatusChange={setStatus}
          onCameraReady={(c) => {
            cameraRef.current = c
          }}
        />
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/40 px-3 py-1.5 font-mono text-xs backdrop-blur-md">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
              status.lod === 'far' && 'bg-sky-500/30 text-sky-200',
              status.lod === 'mid' && 'bg-violet-500/30 text-violet-200',
              status.lod === 'near' && 'bg-emerald-500/30 text-emerald-200',
            )}
          >
            {status.lod}
          </span>
          <span className="text-muted-foreground">
            {copy.status.position(status.startBase + 1, status.endBase)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {copy.status.bpp(status.bpp)}
          </span>
        </div>
        <div
          className="text-muted-foreground pointer-events-none absolute right-3 bottom-20 rounded-md bg-black/40 px-3 py-1.5 font-mono text-[11px] backdrop-blur-md"
          aria-hidden
        >
          {copy.shortcutsHint}
        </div>
      </main>
      <footer className="border-t border-white/5 px-4 py-3">
        <Minimap
          payload={payload}
          startBase={status.startBase}
          endBase={status.endBase}
          onSeek={(base) => {
            const span = status.endBase - status.startBase
            const target = Math.max(0, base - span / 2)
            cameraRef.current?.panBy(
              -((target - status.startBase) / status.bpp),
            )
          }}
        />
      </footer>
    </div>
  )
}
