export const commonCopy = {
  chartData: {
    show: 'View as table',
    hide: 'Hide table',
    download: 'CSV',
    downloadAria: (caption: string) => `Download ${caption} as CSV`,
  },
  brandName: 'REJ Studio',
  // The accessible name of every "What is this?" infotip (`TermHint`), in
  // both the gene pages and the design tool.
  termHintAria: (term: string) => `What is ${term}?`,
  sidebar: {
    open: 'Open sidebar',
    close: 'Close sidebar',
    // The sidebar is the app's navigation landmark, so it carries a name a
    // screen reader can jump to ("Main navigation").
    navLabel: 'Main',
    // On phones the sidebar is a dialog, which needs its own name and
    // description; the shadcn primitive only has placeholders.
    sheetTitle: 'Main navigation',
    sheetDescription:
      'Pages, favorite genes, recent genes, designs and settings.',
  },
  // Header context label, shown once the page title has scrolled away.
  pageContext: {
    genes: 'Gene search',
    designTool: 'Design Tool',
    diseaseAssociations: 'Disease-Associated Genes',
    architecture: 'Architecture',
  },
  actions: {
    tryAgain: 'Try again',
    goHome: 'Go home',
    goBack: 'Go back',
    cancel: 'Cancel',
    edit: 'Edit',
    copy: 'Copy',
  },
  menu: {
    settings: 'Settings',
    theme: {
      label: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    importUserData: 'Import user data',
    exportData: 'Export data',
    importData: 'Import data',
    seedData: 'Seed data',
    clearSeedData: 'Clear seed data',
    seedResult: (favorites: number, recents: number, jobs: number) =>
      `Seeded ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
    noSeedToClear: 'No seed data to clear',
    seedCleared: (favorites: number, recents: number, jobs: number) =>
      `Cleared ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
  },
} as const
