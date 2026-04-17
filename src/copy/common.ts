export const commonCopy = {
  sidebar: {
    open: 'Open sidebar',
    close: 'Close sidebar',
  },
  actions: {
    tryAgain: 'Try Again',
    goHome: 'Go Home',
    goBack: 'Go Back',
    retry: 'Retry',
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
    restartTours: 'Restart tours',
    toursReset: 'Tours reset — they will appear on your next visit',
    seedData: 'Seed data',
    clearSeedData: 'Clear seed data',
    seedResult: (favorites: number, recents: number, jobs: number) =>
      `Seeded ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
    noSeedToClear: 'No seed data to clear',
    seedCleared: (favorites: number, recents: number, jobs: number) =>
      `Cleared ${favorites} favorites, ${recents} recents, ${jobs} jobs`,
  },
} as const
