export const appCopy = {
  errorBoundary: {
    eyebrow: 'Unexpected error',
    title: 'Something went wrong',
    description:
      'An unexpected mutation occurred. Try again, or reload the page.',
    reassurance: 'Don’t worry — no sequences were harmed.',
    search: {
      title: 'Search unavailable',
      description:
        'We couldn’t load gene data right now. This is usually temporary.',
    },
    designTool: {
      title: 'Design tool error',
      description:
        'Something went wrong loading the design tool. Your work is safe.',
      backToSearch: 'Back to Search',
    },
  },
  notFound: {
    eyebrow: '404 · Page not found',
    description: 'This sequence doesn’t map to anything.',
    detail:
      'The page you’re looking for may have been spliced out. Head back or return home.',
  },
  geneNotFound: {
    eyebrow: '404 · Gene not found',
    title: (symbol: string) => `No gene matches “${symbol}”`,
    titleUnknown: 'Gene not found in our database',
    detail:
      'Symbols are case-sensitive (TP53 for human, Trp53 for mouse), and some genes aren’t indexed yet.',
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
    searchPrompt: 'What gene are you optimizing?',
    searchSubcopy: 'Search by symbol, name, or disease — or',
    designLink: 'Design a Custom Sequence',
  },
} as const
