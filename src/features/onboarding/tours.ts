import type { DriveStep } from 'driver.js'
import { onboardingCopy } from './copy'

export type TourId = 'home' | 'gene-detail' | 'design-tool' | 'guided'

export interface TourDefinition {
  id: TourId
  steps: DriveStep[]
}

export interface GuidedStep extends DriveStep {
  route: string
}

const copy = onboardingCopy.tours

// Gene used as the sample during the guided walkthrough. Picked for stable
// presence across dev/prod seeds and because it's commonly referenced in the
// existing copy ("try ATM or TP53").
export const GUIDED_SAMPLE_GENE = 'TP53'

export const guidedTour: GuidedStep[] = [
  {
    route: '/',
    element: '[data-tour="home-search"]',
    popover: {
      title: copy.home.search.title,
      description: copy.home.search.description,
      side: 'bottom',
      align: 'center',
    },
  },
  {
    route: `/genes/${GUIDED_SAMPLE_GENE}`,
    element: '[data-tour="isoform-table"]',
    popover: {
      title: copy.geneDetail.compare.title,
      description: copy.geneDetail.compare.description,
      side: 'top',
      align: 'center',
    },
  },
  {
    route: `/genes/${GUIDED_SAMPLE_GENE}`,
    element: '[data-tour="isoform-actions"]',
    popover: {
      title: copy.geneDetail.customize.title,
      description: copy.geneDetail.customize.description,
      side: 'left',
      align: 'center',
    },
  },
  {
    route: '/design-tool',
    element: '[data-tour="dt-sequence"]',
    popover: {
      title: copy.designTool.sequence.title,
      description: copy.designTool.sequence.description,
      side: 'bottom',
      align: 'center',
    },
  },
  {
    route: '/design-tool',
    element: '[data-tour="dt-optimization"]',
    popover: {
      title: copy.designTool.optimization.title,
      description: copy.designTool.optimization.description,
      side: 'top',
      align: 'center',
    },
  },
  {
    route: '/design-tool',
    element: '[data-tour="dt-submit"]',
    popover: {
      title: copy.designTool.submit.title,
      description: copy.designTool.submit.description,
      side: 'top',
      align: 'center',
    },
  },
  {
    route: '/',
    element: '[data-tour="sidebar-history"]',
    popover: {
      title: copy.guided.history.title,
      description: copy.guided.history.description,
      side: 'right',
      align: 'center',
    },
  },
  {
    route: '/',
    element: '[data-tour="nav-disease"]',
    popover: {
      title: copy.guided.disease.title,
      description: copy.guided.disease.description,
      side: 'right',
      align: 'center',
    },
  },
  {
    route: '/',
    element: '[data-tour="nav-docs"]',
    popover: {
      title: copy.guided.docs.title,
      description: copy.guided.docs.description,
      side: 'right',
      align: 'center',
    },
  },
  {
    route: '/',
    element: '[data-tour="nav-settings"]',
    popover: {
      title: copy.guided.settings.title,
      description: copy.guided.settings.description,
      side: 'right',
      align: 'center',
    },
  },
]

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
