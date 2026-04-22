export const appCopy = {
  errorBoundary: {
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
    code: '404',
    description: 'This sequence doesn’t map to anything.',
    detail:
      'The page you’re looking for may have been spliced out. Head back or return home.',
  },
  home: {
    metadataTitle: 'REJ Studio — RNA End-Joining sequence design',
    metadataDescription:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
    ogTitle: 'RNA End-Joining sequence design',
    ogDescription:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.',
    searchPrompt: 'What gene are you optimizing?',
    orPrefix: 'Search by symbol, name, or disease.',
    designLink: 'Design your own sequence',
  },
} as const
