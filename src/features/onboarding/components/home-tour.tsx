'use client'

import { Tour } from './tour'
import { homeTour } from '../tours'

export function HomeTour() {
  return <Tour tour={homeTour} />
}
