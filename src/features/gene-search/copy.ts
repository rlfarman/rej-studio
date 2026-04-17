export const geneSearchCopy = {
  trigger: {
    label: 'Search for genes',
    kbdHintPrefix: 'Press',
  },
  command: {
    inputAria: 'Search genes',
    placeholder: 'Search by gene symbol, name, or disease...',
    placeholderMobile: 'Search genes…',
    searching: 'Searching…',
    retry: 'Retry',
    promptEmpty: 'Search by gene symbol, name, or disease.',
    favorites: 'Favorites',
    recentGenes: 'Recent genes',
    customize: 'Customize',
    customizeAria: (id: string) => `Customize ${id}`,
    speciesOptions: {
      all: 'All',
      human: 'Human',
      mouse: 'Mouse',
    },
  },
  results: {
    errorSuffix: 'Try again in a moment.',
    noMatches: (query: string) => `No genes match “${query}”.`,
    enterCustom: 'Enter a custom sequence instead.',
  },
  favoriteButton: {
    remove: 'Remove from favorites',
    add: 'Add to favorites',
  },
  recentGenesPanel: {
    label: 'Recent searches',
    empty: 'No recent searches. Search for a gene to get started.',
    removeAria: (symbol: string) => `Remove ${symbol} from recent searches`,
  },
  favoritesPanel: {
    label: 'Favorites',
    empty: 'No favorites yet. Star a gene to save it here.',
    removeAria: (symbol: string) => `Remove ${symbol} from favorites`,
  },
} as const
