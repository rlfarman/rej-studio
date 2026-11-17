import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    // TanStack Start's router (src/router.tsx) and vite.config.ts are found
    // by knip's Vite plugin. File routes are entries; `-components/` are not.
    'src/routes/**/!(-)*.tsx',
    'scripts/**/*.{ts,tsx,mjs}',
    'src/test/**',
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
  ],
}

export default config
