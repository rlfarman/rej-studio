'use client'

import { useTour } from '../hooks/use-tour'
import { designToolTour } from '../tours'

export function DesignToolTour() {
  useTour({ tour: designToolTour })
  return null
}
