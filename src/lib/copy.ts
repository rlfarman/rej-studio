/**
 * Shared app-level copy — strings used across features or in the shell
 * (layout, sidebar, error boundaries, home page, footer).
 *
 * Feature-specific strings belong in their own copy module:
 *   - src/features/gene-search/copy.ts
 *   - src/features/design-tool/copy.ts
 */

import type { CopyFn } from '@/lib/copy-types'

export const appCopy = {
  siteName: 'REJ Studio',

  rootMetadata: {
    titleDefault: 'REJ Studio',
    titleTemplate: '%s | REJ Studio',
    description:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
    ogSiteName: 'REJ Studio',
    appleWebAppTitle: 'REJ Studio',
  },

  home: {
    title: 'REJ Studio — RNA End-Joining sequence design',
    description:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
    ogTitle: 'RNA End-Joining sequence design',
    ogDescription:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.',
    ogImageAlt: 'REJ Studio — RNA End-Joining made easy',
    subtitle: 'RNA END-JOINING (REJ) Studio',
    heading: 'What gene are you optimizing?',
    designPromptPrefix: 'Try searching for a gene, or ',
    designPromptLink: 'design your own',
    designPromptSuffix: '.',
  },

  rootError: {
    title: 'Something went wrong',
    message: 'An unexpected mutation occurred in our process.',
    subtext: 'Don\u2019t worry \u2014 no sequences were harmed.',
    tryAgain: 'Try Again',
    goHome: 'Go Home',
  },

  notFound: {
    status: '404',
    message: 'This sequence doesn\u2019t map to anything.',
    subtext: 'The page you\u2019re looking for may have been spliced out.',
    goBack: 'Go Back',
    goHome: 'Go Home',
  },

  skipToContent: 'Skip to content',

  nav: {
    home: 'Home',
    designTool: 'Design Tool',
    documentation: 'Documentation',
    salkInstitute: 'Salk Institute',
    salkImageAlt: 'Salk Institute',
  },

  sidebar: {
    openLabel: 'Open sidebar',
    closeLabel: 'Close sidebar',
  },

  settings: {
    label: 'Settings',
    themeLabel: 'Theme',
    themes: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    exportData: 'Export data',
    importData: 'Import data',
    importAriaLabel: 'Import user data',
    restartTours: 'Restart tours',
    toursReset: 'Tours reset — they will appear on your next visit',
    seedData: 'Seed data',
    seedSuccess: ((favorites: number, recents: number, jobs: number) =>
      `Seeded ${favorites} favorites, ${recents} recents, ${jobs} jobs`) satisfies CopyFn<
      'favorites' | 'recents' | 'jobs'
    >,
    clearSeedData: 'Clear seed data',
    noSeedData: 'No seed data to clear',
    clearSuccess: ((favorites: number, recents: number, jobs: number) =>
      `Cleared ${favorites} favorites, ${recents} recents, ${jobs} jobs`) satisfies CopyFn<
      'favorites' | 'recents' | 'jobs'
    >,
    importSuccess: ((n: number) =>
      `Imported ${n} data ${n === 1 ? 'category' : 'categories'}`) satisfies CopyFn<'count'>,
    importFailed: 'Import failed',
  },

  suitability: {
    'single-aav': 'Single AAV',
    'dual-aav': 'Dual AAV',
    'triple-aav': 'Triple AAV',
  },

  species: {
    human: 'Human',
    mouse: 'Mouse',
  },

  speciesFilter: {
    human: 'Humans',
    mouse: 'Mice',
    both: 'Humans & Mice',
  },

  footer: {
    citation: 'Bachmann et al. (2026) — RNA-fragment end joining (REJ)',
    citationFull: `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL\nA combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2026)`,
    copyTitle: 'Copy citation to clipboard',
    copied: 'Copied!',
    copyPrompt: 'Click to copy the citation to your clipboard.',
  },
} as const
