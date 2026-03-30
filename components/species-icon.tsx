import { User, RatIcon, Dna } from 'lucide-react'
import type { SpeciesFilter } from '@/lib/species'

export function SpeciesIcon({
  species,
  className,
}: {
  species?: SpeciesFilter | string
  className?: string
}) {
  switch (species) {
    case 'human':
      return <User className={`size-5 ${className}`} />
    case 'mouse':
      return <RatIcon className={`size-5 ${className}`} />
    default:
      return <Dna className={`size-5 ${className}`} />
  }
}
