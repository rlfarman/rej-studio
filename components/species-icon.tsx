import { User, RatIcon } from 'lucide-react'

export function SpeciesIcon({
  species,
  className,
}: {
  species?: string
  className?: string
}) {
  switch (species) {
    case 'human':
      return <User className={`size-5 ${className}`} />
    case 'mouse':
      return <RatIcon className={`size-5 ${className}`} />
    case 'both':
      return (
        <div className={`flex ${className}`}>
          <User className="size-5" />
          <RatIcon className="size-5" />
        </div>
      )
    default:
      return (
        <div className={`flex ${className}`}>
          <User className="size-5" />
          <RatIcon className="size-5" />
        </div>
      )
  }
}
