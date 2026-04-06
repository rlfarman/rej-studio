import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    'src/app/**/{page,layout,template,loading,error,not-found,route,default}.{ts,tsx}',
    'src/app/**/{opengraph,twitter}-image.{ts,tsx}',
    'src/app/{sitemap,robots,manifest,icon,apple-icon}.{ts,tsx}',
    'src/proxy.ts',
    'src/instrumentation.ts',
    'src/sentry.client.config.ts',
    'src/sentry.server.config.ts',
    'src/sentry.edge.config.ts',
    'next.config.{ts,js,mjs}',
    'drizzle.config.ts',
    'scripts/**/*.{ts,tsx}',
  ],
  project: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
  ignore: ['src/components/ui/**'],
  ignoreDependencies: [
    // Tailwind / PostCSS pipeline
    '@tailwindcss/postcss',
    'postcss',
    'tailwindcss-animate',
    'prettier-plugin-tailwindcss',
    // shadcn/ui expects these as peer-ish runtime deps even if not imported directly
    'class-variance-authority',
    // Used by scripts/generate-api-types.sh via npx
    'openapi-typescript',
  ],
  ignoreBinaries: ['modal'],
}

export default config
