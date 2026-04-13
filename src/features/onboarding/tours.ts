import type { TourDefinition } from './types'

export const homeTour: TourDefinition = {
  id: 'home',
  steps: [
    {
      id: 'home-search',
      target: '[data-tour="home-search"]',
      title: 'Search for genes',
      description:
        'Type a gene symbol like ATM or TP53 to get started. You can also press ⌘K from any page to open search.',
      placement: 'bottom',
      spotlightPadding: 12,
    },
    {
      id: 'home-design-link',
      target: '[data-tour="home-design-link"]',
      title: 'Or paste your own sequence',
      description:
        'Already have a coding sequence? Jump straight to the Design Tool and paste it in.',
      placement: 'bottom',
    },
  ],
}

export const geneDetailTour: TourDefinition = {
  id: 'gene-detail',
  steps: [
    {
      id: 'gene-favorite',
      target: '[data-tour="gene-favorite"]',
      title: 'Save to favorites',
      description:
        'Star genes you work with frequently. They appear in the sidebar for quick access.',
      placement: 'bottom',
    },
    {
      id: 'gene-isoform-table',
      target: '[data-tour="isoform-table"]',
      title: 'Compare isoforms',
      description:
        'Sort by CDS length, GC content, or suitability score. Click a row to expand and preview the split.',
      placement: 'bottom',
      spotlightPadding: 4,
    },
    {
      id: 'gene-customize',
      target: '[data-tour="isoform-actions"]',
      title: 'Customize or download',
      description:
        'Send any isoform to the Design Tool for optimization, or download the sequence directly as FASTA.',
      placement: 'left',
    },
  ],
}

export const designToolTour: TourDefinition = {
  id: 'design-tool',
  steps: [
    {
      id: 'dt-sequence',
      target: '[data-tour="dt-sequence"]',
      title: 'Name & sequence',
      description:
        'Give your job a name and paste a coding sequence. Toggle between DNA and protein input — protein is auto-reverse-translated.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'dt-splicer',
      target: '[data-tour="dt-splicer"]',
      title: 'Set the split point',
      description:
        'Drag the scissors to control where the sequence divides into 5\u2032 and 3\u2032 fragments for dual-AAV delivery.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'dt-optimization',
      target: '[data-tour="dt-optimization"]',
      title: 'Tune optimization',
      description:
        'Configure codon optimization, splice site removal, CpG minimization, and stimulatory introns.',
      placement: 'top',
      spotlightPadding: 4,
    },
    {
      id: 'dt-submit',
      target: '[data-tour="dt-submit"]',
      title: 'Run the optimizer',
      description:
        'Submit your sequence. Results include optimized fragments, codon changes, restriction sites, and downloadable files.',
      placement: 'top',
    },
  ],
}
