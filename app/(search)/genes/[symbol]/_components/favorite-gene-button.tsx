'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addFavorite, removeFavorite } from '@/actions'
import { Heart, HeartPulse } from 'lucide-react'

interface FavoriteButtonProps {
  geneId: string
  isFavorite: boolean
}

export function FavoriteGeneButton({
  geneId,
  isFavorite,
}: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState(isFavorite)
  const router = useRouter()

  const handleFavoriteClick = async () => {
    try {
      if (favorite) {
        await removeFavorite({
          geneId,
          userId: 'abcd1234',
        })
      } else {
        await addFavorite({
          geneId,
          userId: 'abcd1234',
        })
      }
      setFavorite(!favorite)
      router.refresh() // Refresh the page to update the favorite status
    } catch (error) {
      console.error('Error updating favorite status:', error)
    }
  }

  return (
    <Button onClick={handleFavoriteClick} variant="ghost" size="icon">
      <Heart
        className={`size-5 ${
          favorite ? 'text-destructive' : 'text-muted-foreground'
        }`}
      />
    </Button>
  )
}
