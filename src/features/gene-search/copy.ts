/**
 * User-facing copy for the gene-search feature.
 *
 * Single source of truth for every string the user sees — search UI,
 * isoform tables, summaries, comparison sheets, 404s, error boundaries.
 * Components and API layers import from here rather than inlining text.
 *
 * Organized by surface (search, isoforms, compare, errors, …) rather than
 * by component, so a copy edit is one file and one search.
 */

import type { CopyFn } from '@/lib/copy-types'

export const geneSearchCopy = {
  metadata: {
    title: 'Search Genes',
    description:
      'Search by gene symbol, name, or disease across human and mouse genomes. Browse isoforms and download optimized sequences.',
    ogDescription:
      'Search by gene symbol, name, or disease across human and mouse genomes.',
  },

  search: {
    triggerLabel: 'Search for Genes',
    pressKey: 'Press',
    shortcut: 'Ctrl+K',
    inputAriaLabel: 'Search genes',
    inputPlaceholder: 'Search by gene symbol, name, or disease...',
    loading: 'Searching\u2026',
    emptyPrompt: 'Search by gene symbol, name, or disease.',
    noMatches: ((query: string) =>
      `No genes match "${query}".`) satisfies CopyFn<'query'>,
    customSequenceLink: 'Enter a custom sequence instead.',
    retry: 'Retry',
    tryAgainLater: 'Try again in a moment.',
    customizeAction: 'Customize',
    customizeAriaLabel: ((isoformId: string) =>
      `Customize ${isoformId}`) satisfies CopyFn<'isoformId'>,
    groups: {
      favorites: 'Favorites',
      recent: 'Recent Genes',
    },
    species: {
      all: 'All',
      human: 'Human',
      mouse: 'Mouse',
    },
    errors: {
      rateLimited: ((retrySeconds: number) =>
        `Too many search requests. Please wait ${retrySeconds}s.`) satisfies CopyFn<'retrySeconds'>,
      unavailable: 'Search is temporarily unavailable.',
      failed: 'Search failed. Please try again.',
    },
  },

  favoritesPanel: {
    heading: 'Favorites',
    emptyState: 'No favorites yet. Star a gene to save it here.',
    removeAriaLabel: ((symbol: string) =>
      `Remove ${symbol} from favorites`) satisfies CopyFn<'symbol'>,
    showLess: 'Show less',
    showMore: ((n: number) => `+ Show ${n} more`) satisfies CopyFn<'count'>,
  },

  recentPanel: {
    heading: 'Recent Searches',
    emptyState: 'Your recent gene searches will appear here.',
    clear: 'Clear',
    removeAriaLabel: ((symbol: string) =>
      `Remove ${symbol} from recent searches`) satisfies CopyFn<'symbol'>,
    showLess: 'Show less',
    showMore: ((n: number) => `+ Show ${n} more`) satisfies CopyFn<'count'>,
  },

  favoriteButton: {
    add: 'Add to favorites',
    remove: 'Remove from favorites',
  },

  isoformTable: {
    emptyForSpecies:
      'No isoforms available for this species. Try selecting a different species filter.',
    expandAllAriaLabel: 'Expand all isoforms',
    collapseAllAriaLabel: 'Collapse all isoforms',
    expandAllTooltip: 'Expand all',
    collapseAllTooltip: 'Collapse all',
    actionsAriaLabel: ((isoformId: string) =>
      `Actions for ${isoformId}`) satisfies CopyFn<'isoformId'>,
    columns: {
      enstLong: 'Ensembl Transcript ID',
      enstShort: 'ENST',
      cds: 'CDS',
      protein: 'Protein',
      gcPercent: 'GC %',
      cpg: 'CpG',
      wggw: 'WGGW',
      suitability: 'Suitability',
    },
    units: {
      bp: 'bp',
      aa: 'aa',
    },
    actions: {
      downloadPrecomputed: 'Download precomputed',
      downloadPrecomputedAriaLabel: ((isoformId: string) =>
        `Download precomputed for ${isoformId}`) satisfies CopyFn<'isoformId'>,
      customize: 'Customize',
      copyCds: 'Copy CDS',
      copyFasta: 'Copy FASTA',
      copied: 'Copied!',
      downloadFasta: 'Download FASTA',
      viewOnEnsembl: 'View on Ensembl',
    },
  },

  isoformSummary: {
    isoforms: 'Isoforms',
    cdsRange: 'CDS range',
    aavFit: 'AAV fit',
    aavFitAriaLabel: 'AAV suitability distribution',
    suitabilityShortLabels: {
      single: 'Single',
      dual: 'Dual',
      triple: 'Triple',
    },
    aavSegmentTooltip: ((label: string, count: number) =>
      `${label} AAV · ${count} isoform${count === 1 ? '' : 's'}`) satisfies CopyFn<
      'label' | 'count'
    >,
  },

  isoformMetrics: {
    length: 'Length',
    gcPercent: 'GC %',
    cpg: 'CpG',
    wggwMotifs: 'WGGW motifs',
    aavStrategy: 'AAV strategy',
  },

  isoformSplitPreview: {
    noWggw: 'No WGGW motifs found — this sequence cannot be split by REJ.',
    bestSplit: 'Best REJ split:',
    atBp: 'at bp',
    balance: {
      balanced: 'balanced',
      moderate: 'moderate',
      imbalanced: 'imbalanced',
    },
    aav5Label: '5′ AAV:',
    aav3Label: '3′ AAV:',
    fits: 'fits',
    overLimit: 'over limit',
    overheadNote: ((overhead: number) =>
      `(includes ${overhead.toLocaleString()} bp ITR/promoter/polyA overhead)`) satisfies CopyFn<'overhead'>,
    alternativesLabel: 'Alternatives:',
    alternativesTooltip:
      "Next balanced WGGW candidates — adjust to these in the design tool if the best one doesn't fit AAV.",
    overLimitTooltip: 'One fragment + AAV overhead exceeds ~4,700 bp',
  },

  isoformIdentity: {
    heading: 'Pairwise identity',
    scaleLow: '0%',
    scaleHigh: '100%',
    description:
      'Identity estimated from shared prefix + suffix of protein sequences. Pairs ≥95% share most coding content — consider optimizing one per cluster.',
    jumpTo: ((id: string) => `Jump to ${id}`) satisfies CopyFn<'id'>,
    identityTooltip: ((value: number) =>
      `${value.toFixed(1)}% identity`) satisfies CopyFn<'value'>,
  },

  isoformLengthChart: {
    heading: 'CDS length by isoform',
    bpUnit: 'bp',
    suitabilityLabels: {
      single: 'Single AAV',
      dual: 'Dual AAV',
      triple: 'Triple AAV',
    },
    rowTooltip: ((id: string, length: number, suitability: string) =>
      `${id} · ${length.toLocaleString()} bp · ${suitability}`) satisfies CopyFn<
      'id' | 'length' | 'suitability'
    >,
  },

  compare: {
    title: 'Compare Isoforms',
    description: ((n: number) =>
      `Side-by-side comparison of ${n} selected isoforms`) satisfies CopyFn<'count'>,
    property: 'Property',
    rows: {
      species: 'Species',
      cdsLength: 'CDS Length',
      proteinLength: 'Protein Length',
      gcContent: 'GC Content',
      startCodon: 'Start Codon',
      stopCodon: 'Stop Codon',
      suitability: 'Suitability',
      design: 'Design',
    },
    values: {
      startAtg: 'ATG',
      missing: 'Missing',
      present: 'Present',
      unknown: 'Unknown',
    },
    designAction: 'Design',
  },

  genePage: {
    speciesLabel: 'Species',
    isoformsHeading: 'Isoforms',
    metadataDescription: ((nameOrSymbol: string) =>
      `View all isoforms for ${nameOrSymbol} and download pre-optimized sequences or customize your own.`) satisfies CopyFn<'nameOrSymbol'>,
    ogImageAlt: ((displaySymbol: string) =>
      `${displaySymbol} — REJ Studio`) satisfies CopyFn<'displaySymbol'>,
  },

  notFound: {
    status: '404',
    foundWithSymbolPrefix: 'Gene \u201c',
    foundWithSymbolSuffix: '\u201d not found.',
    foundWithoutSymbol: 'Gene not found in our database.',
    subtext: "The symbol may be misspelled, or it hasn't been indexed yet.",
    didYouMean: 'Did you mean?',
    searchAction: 'Search Genes',
    customSequenceAction: 'Enter Custom Sequence',
  },

  errorBoundary: {
    title: 'Search unavailable',
    message: "We couldn't load gene data right now. This is usually temporary.",
    tryAgain: 'Try Again',
    goHome: 'Go Home',
  },
} as const
