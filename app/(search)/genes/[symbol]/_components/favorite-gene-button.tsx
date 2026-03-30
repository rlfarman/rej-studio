'use client'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { useFavoriteGenes } from '@/context/favorite-genes-context'
import { AnimatePresence, m } from 'motion/react'
import { popSpring } from '@/lib/motion'

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

  const handleFavoriteClick = () => {
    if (isFavorite) {
      removeFavoriteGene(gene.id)
    } else {
      addFavoriteGene(gene)
    }
  }

  return (
    <Button
      onClick={handleFavoriteClick}
      variant="ghost"
      size="icon"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={isFavorite ? 'filled' : 'empty'}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={popSpring}
        >
          <Heart
            className={`size-5 transition-colors duration-200 ${
              isFavorite
                ? 'fill-destructive text-destructive'
                : 'text-muted-foreground'
            }`}
          />
        </m.div>
      </AnimatePresence>
    </Button>
  )
}
