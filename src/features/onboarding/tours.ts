import type { DriveStep } from 'driver.js'
import { onboardingCopy } from './copy'

export type TourId = 'home' | 'gene-detail' | 'design-tool'

export interface TourDefinition {
  id: TourId
  steps: DriveStep[]
}

const tourSelectors = {
  home: ['[data-tour="home-search"]', '[data-tour="home-design-link"]'],
  geneDetail: [
    '[data-tour="gene-favorite"]',
    '[data-tour="isoform-table"]',
    '[data-tour="isoform-actions"]',
  ],
  designTool: [
    '[data-tour="dt-sequence"]',
    '[data-tour="dt-splicer"]',
    '[data-tour="dt-optimization"]',
    '[data-tour="dt-submit"]',
  ],
} as const

const tourLayout: Record<
  string,
  { side: 'bottom' | 'top' | 'left'; align: 'center' }[]
> = {
  home: [
    { side: 'bottom', align: 'center' },
    { side: 'bottom', align: 'center' },
  ],
  geneDetail: [
    { side: 'bottom', align: 'center' },
    { side: 'bottom', align: 'center' },
    { side: 'left', align: 'center' },
  ],
  designTool: [
    { side: 'bottom', align: 'center' },
    { side: 'bottom', align: 'center' },
    { side: 'top', align: 'center' },
    { side: 'top', align: 'center' },
  ],
}

function buildSteps(
  tourKey: keyof typeof onboardingCopy.tours,
  selectorKey: keyof typeof tourSelectors,
): DriveStep[] {
  const copy = onboardingCopy.tours[tourKey].steps
  const selectors = tourSelectors[selectorKey]
  const layout = tourLayout[selectorKey]
  return copy.map((step, i) => ({
    element: selectors[i],
    popover: {
      title: step.title,
      description: step.description,
      ...layout[i],
    },
  }))
}

export const homeTour: TourDefinition = {
  id: 'home',
  steps: buildSteps('home', 'home'),
}

export const geneDetailTour: TourDefinition = {
  id: 'gene-detail',
  steps: buildSteps('geneDetail', 'geneDetail'),
}

export const designToolTour: TourDefinition = {
  id: 'design-tool',
  steps: buildSteps('designTool', 'designTool'),
}
