export const diseaseAssociationsCopy = {
  page: {
    title: 'Disease associations',
    subtitle:
      'Human disease-associated genes whose longest coding sequence exceeds 4,000 bp — a curated set of large-CDS therapeutic targets from OMIM.',
    sourceLabel: 'Source',
    source: 'OMIM phenotype catalog',
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
      symbol: 'Gene',
      name: 'Name',
      inheritance: 'Inheritance',
      phenotypes: 'Phenotypes',
      phenotypeCount: 'Phenotypes',
    },
    empty: 'No genes match the current filters.',
    resultsSummary: (shown: number, total: number) =>
      shown === total ? `${total} genes` : `${shown} of ${total} genes`,
    viewGeneAria: (symbol: string) => `View ${symbol} isoforms`,
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
    heading: 'Disease associations',
    subtitle: 'Reported phenotypes from the OMIM catalog.',
    openOmimGene: 'Open gene in OMIM',
  },
} as const
