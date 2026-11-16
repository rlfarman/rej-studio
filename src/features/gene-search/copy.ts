export const geneSearchCopy = {
  trigger: {
    label: 'Search for genes',
    kbdHintPrefix: 'Press',
  },
  command: {
    inputAria: 'Search genes',
    // Search covers symbols, names, aliases and Ensembl IDs, not diseases;
    // the no-match state points disease searches at the associations page.
    placeholder: 'Gene symbol, name, or Ensembl ID',
    placeholderMobile: 'Search genes…',
    opening: (symbol: string) => `Opening ${symbol}…`,
    searching: (query: string) => `Searching for ${query}…`,
    retry: 'Retry',
    examplesLabel: 'Try',
    examplesAria: 'Example genes',
    exampleAria: (symbol: string) => `Search for ${symbol}`,
    favorites: 'Favorites',
    recentGenes: 'Recent genes',
    recentJobs: 'Recent jobs',
    genes: 'Genes',
    seeAll: (query: string) => `See all results for “${query}”`,
    customize: 'Customize',
    customizeAria: (id: string) => `Customize ${id}`,
    speciesOptions: {
      all: 'All',
      human: 'Human',
      mouse: 'Mouse',
    },
  },
  /** Messages for GET /api/genes/search failures, shown in the palette. */
  searchErrors: {
    invalid:
      'That search couldn’t be read. Queries can be up to 200 characters.',
    unauthenticated: 'Your session has expired. Sign in again to search.',
    rateLimited: (seconds: number) =>
      `Too many searches. Try again in ${seconds}s.`,
    unavailable: 'Search is temporarily unavailable.',
    network: 'Search failed. Please try again.',
  },
  /** First-run hint: genes present in both the sample seed and production. */
  exampleGenes: ['TP53', 'BRCA1', 'CFTR', 'EGFR'],
  searchPage: {
    metadataTitle: 'Search Genes',
    metadataDescription:
      'Search by gene symbol, name, alias, or Ensembl ID across human and mouse genomes. Browse isoforms and download optimized sequences.',
    ogDescription:
      'Search by gene symbol, name, alias, or Ensembl ID across human and mouse genomes.',
    ogImageAlt: 'Gene Search — REJ Studio',
    title: 'Search genes',
    resultsTitle: (query: string) => `Results for “${query}”`,
    inputLabel: 'Search genes',
    submit: 'Search',
    speciesLabel: 'Species',
    resultCount: (n: number) => (n === 1 ? '1 gene' : `${n} genes`),
    truncated: (n: number) =>
      `Showing the first ${n} matches. Add more of the name or symbol to narrow them down.`,
    loading: 'Searching…',
  },
  results: {
    errorSuffix: 'Try again in a moment.',
    rateLimited: 'Too many searches in a short time.',
    noMatches: (query: string) => `No genes match “${query}”.`,
    noMatchesInSpecies: (query: string, species: string) =>
      `No ${species.toLowerCase()} genes match “${query}”.`,
    searchAllSpecies: 'Search all species',
    didYouMean: 'Did you mean',
    diseasePrompt: 'Searching for a disease?',
    diseaseLink: 'Browse disease-associated genes',
    enterCustom: 'Enter a custom sequence instead.',
    matched: {
      symbol: 'Matched on symbol',
      name: 'Matched on name',
      alias: 'Matched on an alias or related term',
      geneId: 'Matched on Ensembl gene ID',
      transcript: (id: string) => `Matched on transcript ${id}`,
    },
  },
  isoformTable: {
    actionsHeader: 'Actions',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    expandAllAria: 'Expand all isoforms',
    collapseAllAria: 'Collapse all isoforms',
    expandRowAria: (id: string) => `Expand ${id} details`,
    collapseRowAria: (id: string) => `Collapse ${id} details`,
    empty: 'No isoforms are indexed for this gene yet.',
    loadingAria: 'Loading isoforms',
    downloadLong: 'Download pre-optimized sequences',
    downloadAria: (id: string) =>
      `Download pre-optimized sequences for ${id} (ZIP)`,
    downloadHint:
      'Ready-made designs built with the default objectives, as a ZIP.',
    customizeLong: 'Customize in the design tool',
    customizeAria: (id: string) => `Customize ${id} in the design tool`,
    customizeHint:
      'Open this isoform in the design tool to pick your own objectives and split point.',
    moreAria: (id: string) => `More actions for ${id}`,
    copyCds: 'Copy CDS',
    copyFasta: 'Copy FASTA',
    copied: 'Copied!',
    downloadFasta: 'Download FASTA',
    viewEnsembl: 'View on Ensembl',
    downloadAllFasta: 'Download FASTA',
    downloadAllFastaAria: (n: number) =>
      `Download all ${n} coding sequences as one FASTA file`,
  },
  summary: {
    isoforms: 'Isoforms',
    cdsRange: 'CDS range',
    aavFit: 'AAV fit',
  },
  terms: {
    gc: {
      label: 'GC %',
      hint: 'Share of G and C bases in the coding sequence. Very high or low GC can hurt synthesis and expression.',
    },
    cpg: {
      label: 'CpG',
      hint: 'Count of C-G dinucleotides. CpGs can trigger innate immune responses (TLR9) and DNA methylation, so therapeutic constructs usually want fewer.',
    },
    wggw: {
      label: 'WGGW',
      hint: 'Candidate split sites: AGGA, AGGT, TGGA, or TGGT motifs (W = A or T). RNA end-joining uses them to divide the CDS into 5′ and 3′ fragments.',
    },
    suitability: {
      label: 'AAV fit',
      hint: 'How many AAV vectors the CDS needs: Single under 4,000 bp, Dual under 8,000 bp, Triple above. Dual and triple designs are reassembled by RNA end-joining.',
    },
    termAria: (term: string) => `What is ${term}?`,
  },
  splitPreview: {
    none: 'No WGGW-capable junctions found — this sequence cannot be split by REJ.',
    bestSplit: 'Best REJ split:',
    atBp: 'at bp',
    inducible: (changes: number) =>
      `(inducible; ${changes} bp change${changes === 1 ? '' : 's'})`,
    balance: {
      balanced: 'balanced',
      moderate: 'moderate',
      imbalanced: 'imbalanced',
    },
    fragment: (end: '5′' | '3′', bp: string) => `${end} AAV: ${bp} bp`,
    fits: 'fits',
    overLimit: 'over limit',
    overhead: (bp: string) => `(includes ${bp} bp ITR/promoter/polyA overhead)`,
    alternatives: 'Alternatives:',
    alternativesHint:
      'Next balanced WGGW-capable candidates — adjust to these in the design tool if the best one doesn’t fit AAV.',
    alternativeTitle: (
      motif: string,
      position: string,
      five: string,
      three: string,
      fromCenter: string,
    ) =>
      `${motif} at bp ${position} · 5′ ${five} bp / 3′ ${three} bp · ${fromCenter} bp from center`,
    overLimitHint: 'One fragment + AAV overhead exceeds ~4,700 bp',
  },
  lengthChart: {
    title: 'CDS length vs. AAV capacity',
    capacityLabel: (bp: string) => `${bp} bp`,
    unit: 'bp',
  },
  favoriteButton: {
    label: (symbol: string) => `Favorite ${symbol}`,
    remove: 'Remove from favorites',
    add: 'Add to favorites',
  },
  genePage: {
    loading: 'Loading gene…',
    loadingAria: 'Loading gene',
  },
  recentGenesPanel: {
    label: 'Recent searches',
    removeAria: (symbol: string) => `Remove ${symbol} from recent searches`,
  },
  favoritesPanel: {
    label: 'Favorites',
    removeAria: (symbol: string) => `Remove ${symbol} from favorites`,
  },
  identityMatrix: {
    title: 'Pairwise identity',
    caption:
      'Pairwise protein identity between isoforms. Rows and columns use the same numbering; each cell is the identity between that row and that column.',
    footnote:
      'Identity estimated from shared prefix + suffix of protein sequences. Pairs ≥95% share most coding content — consider optimizing one per cluster.',
    legendAria: 'Identity scale',
    rowHeader: 'Isoform',
    jumpTo: (id: string) => `Jump to ${id}`,
    cellLabel: (pct: string, a: string, b: string) =>
      `${pct}% identity between ${a} and ${b}`,
  },
} as const
