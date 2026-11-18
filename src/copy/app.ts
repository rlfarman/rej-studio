export const appCopy = {
  // Document <head> defaults for every page (the root route's head()).
  metadata: {
    siteName: 'REJ Studio',
    title: (page: string) => `${page} | REJ Studio`,
    description:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
  },
  skipToContent: 'Skip to content',
  // Shown in the header while the build reads the committed sample corpus.
  sampleData: {
    label: (genes: number) => `Sample data — ${genes} genes`,
    detail:
      'This build reads the small sample gene set, not the full corpus. Set VITE_GENE_DATA_URL and rebuild to serve the real data.',
  },
  errorBoundary: {
    eyebrow: 'Unexpected error',
    // For a failure that is plainly a load failure rather than a bug: the
    // 404 puns read fine, but an error page is the wrong place to joke, and
    // "mutation" is a loaded word for the people using this.
    connectionEyebrow: 'Connection problem',
    title: 'Something went wrong',
    description: 'Something went wrong on this page. Try again, or reload it.',
    reassurance: 'Your saved designs and starred genes are safe.',
    search: {
      title: 'Search unavailable',
      description:
        'We couldn’t load gene data right now. This is usually temporary.',
    },
    // The same boundary covers /genes and /genes/<symbol>; on a gene page a
    // "Search unavailable" heading describes the wrong thing.
    gene: {
      title: (symbol: string) => `Couldn’t load ${symbol}`,
      description:
        'We couldn’t load this gene’s data right now. This is usually temporary.',
    },
    designTool: {
      title: 'Design tool error',
      description:
        'Something went wrong loading the design tool. Your work is safe.',
      backToSearch: 'Back to Search',
    },
  },
  notFound: {
    // The tab title: a 404 that reads "REJ Studio" in the tab strip is
    // indistinguishable from a page that loaded.
    pageTitle: 'Page not found',
    eyebrow: '404 · Page not found',
    description: 'This sequence doesn’t map to anything.',
    detail:
      'The page you’re looking for may have been spliced out. Head back or return home.',
  },
  geneNotFound: {
    // The tab title. The route's own head() names the symbol, which reads as
    // if the gene exists, so the not-found state sets its own.
    pageTitle: 'Gene not found',
    eyebrow: '404 · Gene not found',
    title: (symbol: string) => `No gene matches “${symbol}”`,
    titleUnknown: 'Gene not found in our database',
    detail:
      'Check the spelling: some genes aren’t indexed yet, and mouse symbols differ from human ones (Trp53 for TP53).',
    // A sample build carries 24 genes while the disease table lists 599, so
    // most links out of it land here. Telling someone to check their spelling
    // after they followed a link blames them for the build's contents.
    detailSample:
      'Only the 24 genes in the sample data set are available in this preview.',
    didYouMean: 'Did you mean',
    searchGenes: 'Search genes',
    customSequence: 'Enter a custom sequence',
  },
  home: {
    metadataTitle: 'REJ Studio — RNA End-Joining sequence design',
    metadataDescription:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
    ogTitle: 'RNA End-Joining sequence design',
    ogDescription:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.',
    eyebrow: 'RNA end-joining sequence design',
    searchPrompt: 'What gene are you optimizing?',
    ownSequence: 'Have your own sequence?',
    designLink: 'Open the design tool',
  },
  sidebar: {
    historyHint:
      'Starred genes, recent searches, and design jobs will show up here.',
    nav: {
      home: 'Home',
      designTool: 'Design Tool',
      diseaseAssociations: 'Disease-Associated Genes',
    },
    lab: 'Pfaff Lab | Salk Institute',
    salkLogoAlt: 'Salk Institute',
  },
  maintenance: {
    dismiss: 'Dismiss maintenance notice',
  },
  loading: {
    page: 'Loading page',
    gene: 'Loading gene…',
    geneAria: 'Loading gene',
  },
} as const
