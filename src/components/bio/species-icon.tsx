import { User, RatIcon, Dna } from 'lucide-react'
import type { SpeciesFilter } from '@/lib/bio/species'

export function SpeciesIcon({
  species,
  className,
}: {
  species?: SpeciesFilter | string
  className?: string
}) {
  switch (species) {
    case 'human':
      return <User aria-hidden="true" className={`size-5 ${className}`} />
    case 'mouse':
      return <RatIcon aria-hidden="true" className={`size-5 ${className}`} />
    default:
      return <Dna aria-hidden="true" className={`size-5 ${className}`} />
  }
}
