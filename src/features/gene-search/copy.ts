export const geneSearchCopy = {
  charts: {
    isoformLengths: {
      caption:
        'Coding sequence length of each isoform, and whether it suits a single-vector design',
      columns: ['Isoform', 'Coding sequence length (bp)', 'Suitability'],
    },
    identityMatrix: {
      caption:
        'Protein sequence identity from a global alignment of each pair of isoforms, as a percentage',
      columns: ['Isoform', 'Compared with', 'Identity (%)'],
    },
  },
  trigger: {
    label: 'Search for genes',
    kbdHintPrefix: 'Press',
  },
  command: {
    dialogTitle: 'Search genes',
    dialogDescription:
      'Find a gene by symbol, name or Ensembl ID, or reopen a recent gene or design job.',
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
  /** A search whose index couldn't be loaded, on the page and in the palette. */
  searchErrors: {
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
  genePage: {
    metadataDescription: (name: string) =>
      `View all isoforms for ${name} and download pre-optimized sequences or customize your own.`,
  },
  results: {
    errorSuffix: 'Try again in a moment.',
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
      closeSymbol: 'Close spelling of the symbol',
      closeName: 'Close spelling of a word in the name',
      closeAlias: 'Close spelling of an alias',
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
    downloadLong: 'Download pre-optimized sequences',
    downloadAria: (id: string) =>
      `Download pre-optimized sequences for ${id} (ZIP)`,
    downloadHint:
      'Ready-made designs built with the default objectives, as a ZIP.',
    // Every pre-built package in the corpus is a two-fragment (dual-vector)
    // design, so there is nothing to offer an isoform that needs three.
    downloadUnavailable: 'No pre-optimized ZIP for a triple-AAV sequence',
    downloadUnavailableReason:
      'This coding sequence needs three vectors. The ready-made package is a two-vector design, so both fragments would exceed the AAV packaging limit. Build a three-vector design in the design tool instead.',
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
    // Starts with the visible label, so voice control ("click Download
    // FASTA") finds it (WCAG 2.5.3, label in name).
    downloadAllFastaAria: (n: number) =>
      `Download FASTA of all ${n} coding sequences`,
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
      'Identity from a global alignment of the two protein sequences (BLOSUM62, gap open 11, extend 1): identical positions as a share of all alignment columns, gaps included. Pairs ≥95% share most coding content — consider optimizing one per cluster.',
    truncated: (shown: number, total: number) =>
      `Showing the ${shown} longest of ${total} isoforms.`,
    unavailable:
      'Identities are not available for this gene in this version of the gene data.',
    legendAria: 'Identity scale',
    rowHeader: 'Isoform',
    jumpTo: (id: string) => `Jump to ${id}`,
    cellLabel: (pct: string, a: string, b: string) =>
      `${pct}% aligned identity between ${a} and ${b}`,
  },
} as const
