'use client'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'
import { geneMapCopy } from '../copy'
import type { LayerFlags } from '../types'

interface Props {
  layers: LayerFlags
  onLayerChange: (next: LayerFlags) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  className?: string
}

export function GeneMapControls({
  layers,
  onLayerChange,
  onZoomIn,
  onZoomOut,
  onFit,
  className,
}: Props) {
  const c = geneMapCopy
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', className)}>
      <div className="flex items-center gap-1 rounded-md border p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onZoomOut}
              aria-label={c.controls.zoomOut}
            >
              <Minus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{c.controls.zoomOut}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onFit}
              aria-label={c.controls.fit}
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{c.controls.fit}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onZoomIn}
              aria-label={c.controls.zoomIn}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{c.controls.zoomIn}</TooltipContent>
        </Tooltip>
      </div>
      <span className="text-muted-foreground ml-2 hidden font-mono text-[10px] tracking-wide uppercase sm:inline">
        {c.layers.title}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <LayerToggle
          label={c.layers.aaClass}
          pressed={layers.aaClass}
          onPressedChange={(v) => onLayerChange({ ...layers, aaClass: v })}
          dot="bg-[oklch(0.72_0.15_250)]"
        />
        <LayerToggle
          label={c.layers.cpg}
          pressed={layers.cpg}
          onPressedChange={(v) => onLayerChange({ ...layers, cpg: v })}
          dot="bg-cyan-400"
        />
        <LayerToggle
          label={c.layers.restriction}
          pressed={layers.restriction}
          onPressedChange={(v) => onLayerChange({ ...layers, restriction: v })}
          dot="bg-amber-400"
        />
        <LayerToggle
          label={c.layers.gcHeatmap}
          pressed={layers.gcHeatmap}
          onPressedChange={(v) => onLayerChange({ ...layers, gcHeatmap: v })}
          dot="bg-gradient-to-r from-sky-400 to-orange-400"
        />
      </div>
    </div>
  )
}

function LayerToggle({
  label,
  pressed,
  onPressedChange,
  dot,
}: {
  label: string
  pressed: boolean
  onPressedChange: (v: boolean) => void
  dot: string
}) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="h-7 px-2 text-xs"
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={cn('mr-1.5 inline-block size-2 rounded-full', dot)}
      />
      {label}
    </Toggle>
  )
}
