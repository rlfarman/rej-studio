#!/usr/bin/env node
/**
 * Refuses a deploy that would serve the committed 24-gene sample.
 *
 * Without VITE_GENE_DATA_URL the build reads public/gene-data/sample, which
 * is right for development, tests, CI and the e2e preview, and wrong for the
 * lab: they would get a toy dataset with nothing saying so. `pnpm cf:deploy`
 * runs this first, with the same env the production build sees (the shell
 * plus .env files, through Vite's loadEnv).
 */
import { loadEnv } from 'vite-plus'

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env }
const url = env.VITE_GENE_DATA_URL?.trim()

if (!url) {
  console.error(
    [
      'Refusing to deploy: VITE_GENE_DATA_URL is not set.',
      '',
      'The build would serve the committed 24-gene sample instead of the gene',
      'corpus. Point VITE_GENE_DATA_URL at a published corpus version (for',
      'example the R2 URL ending in /vN) in the shell or .env.production, then',
      'run `pnpm cf:deploy` again.',
    ].join('\n'),
  )
  process.exit(1)
}

if (url.replace(/\/+$/, '') === '/gene-data/sample') {
  console.error(
    'Refusing to deploy: VITE_GENE_DATA_URL points at the 24-gene sample.',
  )
  process.exit(1)
}

console.log(`Deploying with the gene corpus at ${url}`)
