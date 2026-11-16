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
    eyebrow: 'RNA end-joining sequence design',
    searchPrompt: 'What gene are you optimizing?',
    ownSequence: 'Have your own sequence?',
    designLink: 'Open the design tool',
  },
  sidebar: {
    historyHint:
      'Starred genes, recent searches, and design jobs will show up here.',
  },
} as const
