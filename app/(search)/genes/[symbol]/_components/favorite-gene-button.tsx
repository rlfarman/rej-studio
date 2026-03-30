'use client'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { useFavoriteGenes } from '@/context/favorite-genes-context'

interface FavoriteButtonProps {
  gene: {
    id: string
    name: string
    symbol: string
  }
}

export function FavoriteGeneButton({ gene }: FavoriteButtonProps) {
  const { addFavoriteGene, removeFavoriteGene, isFavoriteGene } =
    useFavoriteGenes()
  const isFavorite = isFavoriteGene(gene.id)
  const heartRef = useRef<SVGSVGElement>(null)

  const handleFavoriteClick = () => {
    if (isFavorite) {
      removeFavoriteGene(gene.id)
    } else {
      addFavoriteGene(gene)
      // Trigger pop animation on favorite
      const el = heartRef.current
      if (el) {
        el.classList.remove('animate-heart-pop')
        void (el as unknown as HTMLElement).offsetWidth // force reflow
        el.classList.add('animate-heart-pop')
      }
    }
  }

  return (
    <Button
      onClick={handleFavoriteClick}
      variant="ghost"
      size="icon"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        ref={heartRef}
        className={`size-5 transition-colors duration-200 ${
          isFavorite
            ? 'fill-destructive text-destructive'
            : 'text-muted-foreground'
        }`}
      />
    </Button>
  )
}
