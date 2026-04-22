'use client'

import { useTour } from '../hooks/use-tour'
import { homeTour } from '../tours'

export function HomeTour() {
  useTour({ tour: homeTour })
  return null
}
