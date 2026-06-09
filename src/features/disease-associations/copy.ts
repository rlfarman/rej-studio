export const diseaseAssociationsCopy = {
  page: {
    title: 'Disease-Associated Genes',
    subtitle:
      'Human disease-associated genes whose longest coding sequence exceeds 4,000 bp — highlighting large genes with predesigned REJ sequences.',
    sourceLabel: 'Source',
    source: 'OMIM Phenotype Catalog (4/2026)',
  },
  filters: {
    searchPlaceholder: 'Filter by gene, name, or phenotype…',
    searchAria: 'Filter by gene symbol, name, or phenotype',
    inheritanceLabel: 'Inheritance',
    clearAll: 'Clear',
  },
  table: {
    ariaLabel: 'Disease-associated genes',
    columns: {
      largestCds: 'Largest CDS',
      symbol: 'Gene',
      name: 'Name',
      phenotype: 'Association',
      inheritance: 'Inheritance',
    },
    largestCdsUnit: 'bp',
    largestCdsUnknown: '—',
    phenotypeUnknown: '—',
    empty: 'No genes match the current filters.',
    resultsSummary: (shown: number, total: number) =>
      shown === total ? `${total} genes` : `${shown} of ${total} genes`,
    viewGeneAria: (symbol: string) => `View ${symbol} isoforms`,
    pageSummary: (start: number, end: number, total: number) =>
      `${start}–${end} of ${total}`,
    paginationAria: 'Pagination',
  },
  phenotype: {
    statusLabel: {
      confirmed: 'Confirmed',
      provisional: 'Provisional',
      susceptibility: 'Susceptibility',
      nondisease: 'Nondisease',
    },
    mimLinkAria: (mim: number) => `OMIM phenotype ${mim} (opens in new tab)`,
  },
  geneDetail: {
    heading: 'Disease-Associated Genes',
    subtitle: 'Reported phenotypes from the OMIM catalog.',
    openOmimGene: 'Open gene in OMIM',
  },
} as const
