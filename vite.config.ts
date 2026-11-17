import { writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { cloudflare } from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite-plus'

import { lintConfig } from './lint/config'

/**
 * Public env vars the client code still reads as `process.env.NEXT_PUBLIC_*`
 * (feature flags, the gene-data URL). Vite only exposes `import.meta.env`, so
 * these are inlined at build time, the way Next did, until the readers move
 * to `import.meta.env.VITE_*`. Unset ones become `undefined` rather than a
 * ReferenceError on `process` in the browser.
 *
 * TODO(slice-2): switch the readers to VITE_-prefixed vars and drop this.
 */
const NEXT_PUBLIC_VARS = [
  'NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER',
  'NEXT_PUBLIC_ENABLE_MULTI_SPLIT',
  'NEXT_PUBLIC_GENE_DATA_URL',
  'NEXT_PUBLIC_SITE_URL',
] as const

/** Inlines NEXT_PUBLIC_VARS for the current mode's env (see above). */
function nextPublicEnv(): Plugin {
  return {
    name: 'rej:next-public-env',
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), 'NEXT_PUBLIC_')
      return {
        define: Object.fromEntries(
          NEXT_PUBLIC_VARS.map((name) => [
            `process.env.${name}`,
            env[name] === undefined ? 'undefined' : JSON.stringify(env[name]),
          ]),
        ),
      }
    },
  }
}

/**
 * Makes every page the Worker renders the SPA shell, in production as in
 * `vp dev` (where Start itself sets TSS_SHELL when SPA mode is on).
 *
 * Start's shell prerender tells the server it wants the shell through an
 * `X-TSS_SHELL` header, honoured only when `process.env.TSS_PRERENDERING` is
 * set. Start sets that in the Node build process, but with the Cloudflare
 * plugin the prerender requests are served by workerd, which never sees it,
 * so the "shell" came out as the fully rendered home page. In SPA mode the
 * Worker has no other page to render, so inlining TSS_SHELL=true for the
 * `ssr` (Worker) environment is the same contract the dev server runs under.
 */
function spaShellOnWorker(): Plugin {
  return {
    name: 'rej:spa-shell-on-worker',
    configEnvironment(name) {
      if (name !== 'ssr') return
      return {
        define: {
          'process.env.TSS_SHELL': JSON.stringify('true'),
          'import.meta.env.TSS_SHELL': JSON.stringify('true'),
        },
      }
    },
  }
}

/**
 * Writes the client chunk graph to dist/client-chunks.json for the bundle
 * budgets (scripts/bundle-size.mjs): each chunk's static imports and the
 * source module it was split from, which is how a route's chunk is found.
 * Beside dist/client rather than in it, so it isn't deployed.
 */
function clientChunkGraph(): Plugin {
  return {
    name: 'rej:client-chunk-graph',
    applyToEnvironment: (environment) => environment.name === 'client',
    writeBundle(options, bundle) {
      const chunks = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? [
              {
                file: output.fileName,
                isEntry: output.isEntry,
                module: output.facadeModuleId
                  ? relative(process.cwd(), output.facadeModuleId)
                  : null,
                imports: output.imports,
              },
            ]
          : [],
      )
      writeFileSync(
        join(options.dir ?? 'dist/client', '..', 'client-chunks.json'),
        `${JSON.stringify(chunks, null, 2)}\n`,
      )
    },
  }
}

// An object rather than a function: `vp lint` reads the `lint` block below
// straight from this file.
export default defineConfig({
  // `strictPort`: e2e and the docs assume 3000; fail loudly if it's taken.
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  resolve: { tsconfigPaths: true },
  environments: {
    // Public source maps for the client bundle, as the Next build shipped:
    // readable stack traces in the browser and in Sentry (at cutover), and
    // Lighthouse's valid-source-maps audit. The Worker's maps are uploaded
    // separately by wrangler (`upload_source_maps`).
    client: { build: { sourcemap: true } },
  },
  plugins: [
    // First, per Cloudflare's TanStack Start guide: the Worker is Start's
    // `ssr` environment and runs in workerd in dev, preview and production.
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    nextPublicEnv(),
    spaShellOnWorker(),
    clientChunkGraph(),
    tailwindcss(),
    tanstackStart({
      // SPA mode: the build prerenders one HTML shell (the root route, with
      // the router's pending component where a page would go) and the
      // client renders every page. It is written as index.html because
      // that is the file Workers' `not_found_handling:
      // "single-page-application"` (wrangler.jsonc) serves for every
      // navigation that matches no asset.
      spa: { enabled: true, prerender: { outputPath: '/index.html' } },
    }),
    // After Start, as its docs require.
    react(),
    // React Compiler (automatic memoization), as next.config.ts's
    // `reactCompiler: true` did.
    babel({ presets: [reactCompilerPreset()] }),
  ],
  lint: lintConfig,
})
