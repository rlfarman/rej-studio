import type { KnipConfig } from 'knip'

// Modules the deleted Next pages, route handlers and proxy used, which the
// Start app doesn't reach yet. They stay compiling and tested so slice 2 can
// port the pages and slice 3 can port or delete the server side.
// TODO(slice-2/3): shrink this as pages land; delete it after slice 3.
const AWAITING_PORT = [
  // Feature components, hooks, server actions and queries.
  'src/features/**/*.{ts,tsx}',
  'src/drizzle/**/*.ts',
  'src/lib/auth/**/*.ts',
  // Shared modules whose only importers were Next pages.
  'src/components/bio/diag-badge.tsx',
  'src/components/chart-data-table.tsx',
  'src/components/page-title.tsx',
  'src/components/search-shortcut.tsx',
  'src/components/track-on-mount.tsx',
  'src/lib/bio/aav.ts',
  'src/lib/bio/sequence-utils.ts',
]

const config: KnipConfig = {
  entry: [
    // TanStack Start's router (src/router.tsx) and vite.config.ts are found
    // by knip's Vite plugin. File routes are entries; `-components/` are not.
    'src/routes/**/!(-)*.tsx',
    'scripts/**/*.{ts,tsx,mjs}',
    'src/test/**',
    ...AWAITING_PORT,
  ],
  project: [
    'src/**/*.{ts,tsx}',
    'scripts/**/*.{ts,tsx,mjs}',
    'lint/**/*.{ts,mjs}',
  ],
  ignore: ['src/components/ui/**'],
  storybook: {
    config: ['.storybook/main.ts'],
    entry: ['.storybook/preview.tsx', 'src/**/*.stories.{ts,tsx}'],
  },
  ignoreDependencies: [
    // Tailwind pipeline: imported from globals.css and fonts.css (knip
    // doesn't follow CSS imports).
    'tailwindcss',
    'tw-animate-css',
    'shadcn',
    '@fontsource-variable/.*',
    // Used by scripts/generate-api-types.sh via npx
    'openapi-typescript',
  ],
}

export default config
