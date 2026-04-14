import type { DriveStep } from 'driver.js'

export type TourId = 'home' | 'gene-detail' | 'design-tool'

export interface TourDefinition {
  id: TourId
  steps: DriveStep[]
}

export const homeTour: TourDefinition = {
  id: 'home',
  steps: [
    {
      element: '[data-tour="home-search"]',
      popover: {
        title: 'Search for genes',
        description:
          'Type a gene symbol like ATM or TP53 to get started. You can also press ⌘K from any page to open search.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="home-design-link"]',
      popover: {
        title: 'Or paste your own sequence',
        description:
          'Already have a coding sequence? Jump straight to the Design Tool and paste it in.',
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
        title: 'Save to favorites',
        description:
          'Star genes you work with frequently. They appear in the sidebar for quick access.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="isoform-table"]',
      popover: {
        title: 'Compare isoforms',
        description:
          'Sort by CDS length, GC content, or suitability score. Click a row to expand and preview the split.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="isoform-actions"]',
      popover: {
        title: 'Customize or download',
        description:
          'Send any isoform to the Design Tool for optimization, or download the sequence directly as FASTA.',
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
        title: 'Name & sequence',
        description:
          'Give your job a name and paste a coding sequence. Toggle between DNA and protein input — protein is auto-reverse-translated.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dt-splicer"]',
      popover: {
        title: 'Set the split point',
        description:
          'Drag the scissors to control where the sequence divides into 5\u2032 and 3\u2032 fragments for dual-AAV delivery.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dt-optimization"]',
      popover: {
        title: 'Tune optimization',
        description:
          'Configure codon optimization, splice site removal, CpG minimization, and stimulatory introns.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dt-submit"]',
      popover: {
        title: 'Run the optimizer',
        description:
          'Submit your sequence. Results include optimized fragments, codon changes, restriction sites, and downloadable files.',
        side: 'top',
        align: 'center',
      },
    },
  ],
}
