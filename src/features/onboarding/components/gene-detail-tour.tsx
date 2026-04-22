'use client'

import { useTour } from '../hooks/use-tour'
import { geneDetailTour } from '../tours'

export function GeneDetailTour() {
  useTour({ tour: geneDetailTour })
  return null
}
