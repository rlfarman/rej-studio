export const geneSearchCopy = {
  charts: {
    isoformLengths: {
      caption:
        'Coding sequence length of each isoform, and whether it suits a single-vector design',
      columns: ['Isoform', 'Coding sequence length (bp)', 'Suitability'],
    },
    identityMatrix: {
      caption:
        'Protein sequence identity between each pair of isoforms, as a percentage',
      columns: ['Isoform', 'Compared with', 'Identity (%)'],
    },
  },
  trigger: {
    label: 'Search for genes',
    kbdHintPrefix: 'Press',
  },
  command: {
    inputAria: 'Search genes',
    placeholder: 'Gene symbol, name, or disease',
    placeholderMobile: 'Search genes…',
    opening: (symbol: string) => `Opening ${symbol}…`,
    retry: 'Retry',
    examplesLabel: 'Try',
    examplesAria: 'Example genes',
    exampleAria: (symbol: string) => `Search for ${symbol}`,
    favorites: 'Favorites',
    recentGenes: 'Recent genes',
    recentJobs: 'Recent jobs',
    genes: 'Genes',
    customize: 'Customize',
    customizeAria: (id: string) => `Customize ${id}`,
    speciesOptions: {
      all: 'All',
      human: 'Human',
      mouse: 'Mouse',
    },
  },
  /** First-run hint: genes present in both the sample seed and production. */
  exampleGenes: ['TP53', 'BRCA1', 'CFTR', 'EGFR'],
  searchPage: {
    title: 'Search genes',
    resultsTitle: (query: string) => `Results for “${query}”`,
    inputLabel: 'Search genes',
    submit: 'Search',
    speciesLabel: 'Species',
    resultCount: (n: number) => (n === 1 ? '1 gene' : `${n} genes`),
  },
  results: {
    errorSuffix: 'Try again in a moment.',
    noMatches: (query: string) => `No genes match “${query}”.`,
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
  lengthChart: {
    title: 'CDS length vs. AAV capacity',
    capacityLabel: (bp: string) => `${bp} bp`,
    unit: 'bp',
  },
  favoriteButton: {
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
      'Identity estimated from shared prefix + suffix of protein sequences. Pairs ≥95% share most coding content — consider optimizing one per cluster.',
    legendAria: 'Identity scale',
    rowHeader: 'Isoform',
  },
} as const
