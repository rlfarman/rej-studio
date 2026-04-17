import type { DriveStep } from 'driver.js'
import { onboardingCopy } from './copy'

export type TourId = 'home' | 'gene-detail' | 'design-tool'

export interface TourDefinition {
  id: TourId
  steps: DriveStep[]
}

const copy = onboardingCopy.tours

export const homeTour: TourDefinition = {
  id: 'home',
  steps: [
    {
      element: '[data-tour="home-search"]',
      popover: {
        title: copy.home.search.title,
        description: copy.home.search.description,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="home-design-link"]',
      popover: {
        title: copy.home.paste.title,
        description: copy.home.paste.description,
        side: 'bottom',
        align: 'center',
      },
    },
  ],
}

export const geneDetailTour: TourDefinition = {
  id: 'gene-detail',
  steps: [
    {
      element: '[data-tour="gene-favorite"]',
      popover: {
        title: copy.geneDetail.favorite.title,
        description: copy.geneDetail.favorite.description,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="isoform-table"]',
      popover: {
        title: copy.geneDetail.compare.title,
        description: copy.geneDetail.compare.description,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="isoform-actions"]',
      popover: {
        title: copy.geneDetail.customize.title,
        description: copy.geneDetail.customize.description,
        side: 'left',
        align: 'center',
      },
    },
  ],
}

export const designToolTour: TourDefinition = {
  id: 'design-tool',
  steps: [
    {
      element: '[data-tour="dt-sequence"]',
      popover: {
        title: copy.designTool.sequence.title,
        description: copy.designTool.sequence.description,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dt-splicer"]',
      popover: {
        title: copy.designTool.splicer.title,
        description: copy.designTool.splicer.description,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dt-optimization"]',
      popover: {
        title: copy.designTool.optimization.title,
        description: copy.designTool.optimization.description,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dt-submit"]',
      popover: {
        title: copy.designTool.submit.title,
        description: copy.designTool.submit.description,
        side: 'top',
        align: 'center',
      },
    },
  ],
}
