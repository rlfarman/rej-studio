'use client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { geneMapCopy } from '../copy'
import type { GeneMapIsoform } from '../types'

interface Props {
  isoforms: GeneMapIsoform[]
  value: string
  onValueChange: (next: string) => void
}

export function IsoformSwitcher({ isoforms, value, onValueChange }: Props) {
  if (isoforms.length <= 1) return null
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="h-8 w-auto min-w-[10rem] font-mono text-xs"
        aria-label={geneMapCopy.isoform.selectAria}
      >
        <SelectValue placeholder={geneMapCopy.isoform.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isoforms.map((iso) => (
          <SelectItem key={iso.id} value={iso.id} className="font-mono text-xs">
            {iso.id}
            <span className="text-muted-foreground ml-2 tabular-nums">
              {iso.codingSequenceLength.toLocaleString()} bp
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
