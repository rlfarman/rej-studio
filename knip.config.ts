import type { KnipConfig } from 'knip'

// The Next-era server side, which no page reaches any more: designs and
// gene search run in the browser. Kept compiling and tested until slice 3
// deletes it (or ports what the Worker needs).
// TODO(slice-3): delete this list with the modules.
const AWAITING_PORT = [
  // Server design jobs: the server action, backend routing, status polling.
  'src/features/design-tool/api/{jobs,job-backend,job-status-client,corpus-version}.ts',
  'src/features/design-tool/components/job-watcher.tsx',
  // Postgres-backed gene reads and the search API's rate limit.
  'src/features/gene-search/api/*.ts',
  'src/drizzle/**/*.ts',
  'src/lib/auth/**/*.ts',
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
