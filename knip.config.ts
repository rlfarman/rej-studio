import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    'src/app/**/{page,layout,template,loading,error,not-found,route,default}.{ts,tsx}',
    'src/app/**/{opengraph,twitter}-image.{ts,tsx}',
    'src/app/{sitemap,robots,manifest,icon,apple-icon}.{ts,tsx}',
    'src/sentry.client.config.ts',
    'src/sentry.server.config.ts',
    'src/sentry.edge.config.ts',
    'next.config.{ts,js,mjs}',
    'scripts/**/*.{ts,tsx}',
    'src/test/**',
  ],
  project: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
  ignore: ['src/components/ui/**'],
  storybook: {
    config: ['.storybook/main.ts', '.storybook/preview.ts'],
    entry: ['src/**/*.stories.{ts,tsx}'],
  },
  ignoreDependencies: [
    // Tailwind / PostCSS pipeline — imported by PostCSS, not by app code
    'tailwindcss',
    'tailwindcss-animate',
    // Used by scripts/generate-api-types.sh via npx
    'openapi-typescript',
    // shadcn/ui components in src/components/ui/ (ignored by Knip) import these
    '@radix-ui/react-radio-group',
    '@radix-ui/react-slider',
    '@radix-ui/react-toggle',
  ],
  ignoreBinaries: ['pip', 'python3'],
}

export default config
