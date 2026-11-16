import { User, RatIcon, Dna } from 'lucide-react'

export function SpeciesIcon({
  species,
  className,
}: {
  /**
   * Any string: callers pass `gene.species` straight from a text column.
   * 'human' and 'mouse' get their own icons; anything else, including the
   * 'both' filter, gets the generic DNA icon.
   */
  species?: string
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
