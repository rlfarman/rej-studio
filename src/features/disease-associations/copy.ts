export const diseaseAssociationsCopy = {
  page: {
    title: 'Disease Associations',
    subtitle:
      'Human disease-associated genes whose longest coding sequence exceeds 4,000 bp — a curated set of large-CDS therapeutic targets from OMIM.',
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
      phenotypes: 'Phenotypes',
    },
    largestCdsUnit: 'bp',
    largestCdsUnknown: '—',
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
    heading: 'Disease Associations',
    subtitle: 'Reported phenotypes from the OMIM catalog.',
    openOmimGene: 'Open gene in OMIM',
  },
} as const
