import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { cloudflare } from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite-plus'

import {
  associationShardUrl,
  buildAssociationShards,
  type AssociationShardManifest,
} from './src/features/disease-associations/shards'
import type { AssociationData } from './src/features/disease-associations/types'
import { lintConfig } from './lint/config'
import {
  PRERENDERED_PAGES,
  SHELL_FILE,
  prerenderJobPath,
  prerenderedFile,
} from './src/server/prerendered-pages'

/**
 * How the Worker decides between the SPA shell and a full page.
 *
 * Start renders the shell when `process.env.TSS_SHELL` is set, or, while
 * `TSS_PRERENDERING` is set, when the request carries `X-TSS_SHELL`, which
 * the build's shell prerender sends. Start sets those in the Node build
 * process, but with the Cloudflare plugin the prerender requests are served
 * by workerd, which never sees them, so they are inlined here:
 *
 * - `vp build`: TSS_PRERENDERING, so the shell prerender gets the shell and
 *   the pages in PRERENDERED_PAGES are rendered in full.
 * - `vp dev`: TSS_SHELL, the same contract Start's own dev server runs under
 *   in SPA mode (every page is the shell, filled in by the client).
 *
 * Deployed, the Worker serves pages from static assets and renders nothing
 * itself (src/server/worker-entry.ts).
 */
function shellOrPageOnWorker(): Plugin {
  return {
    name: 'rej:shell-or-page-on-worker',
    configEnvironment(name, _config, { command }) {
      if (name !== 'ssr') return
      const flag = command === 'build' ? 'TSS_PRERENDERING' : 'TSS_SHELL'
      return {
        define: {
          [`process.env.${flag}`]: JSON.stringify('true'),
          [`import.meta.env.${flag}`]: JSON.stringify('true'),
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

/**
 * Serves the MCP Apps client library at /mcp/app-bridge.js, as a static asset
 * of this build.
 *
 * The design view (src/server/mcp/ui/design-view.ts) is HTML delivered
 * through the protocol, not a page of this app: it has no build of its own,
 * and the bundler cannot reach into it. Inlining half a megabyte of library
 * in every resource read would be worse than serving it from here and naming
 * this origin in the view's content security policy. Under Next this was a
 * script that copied the file into public/; as a plugin it needs no
 * gitignored copy in the tree.
 */
function mcpAppBridge(): Plugin {
  const PATH = '/mcp/app-bridge.js'
  // The dependency-free browser build, by its published entry point.
  const source = createRequire(import.meta.url).resolve(
    '@modelcontextprotocol/ext-apps/app-with-deps',
  )
  return {
    name: 'rej:mcp-app-bridge',
    applyToEnvironment: (environment) => environment.name === 'client',
    // At its own path, unhashed: the view is handed a URL at runtime, so
    // there is nothing to rewrite a hashed name into.
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: PATH.slice(1),
        source: readFileSync(source),
      })
    },
    configureServer(server) {
      server.middlewares.use(PATH, (_request, response) => {
        response.setHeader('content-type', 'text/javascript; charset=utf-8')
        response.end(readFileSync(source))
      })
    },
  }
}

/**
 * Splits the disease-associations table into one small file per symbol
 * prefix (src/features/disease-associations/shards.ts), so a gene page
 * fetches a few KB rather than the whole ~376 KB table.
 *
 * Generated from the committed associations.json at build time, rather than
 * committed as ~200 more files. They go under /assets/, in a directory named
 * for their content: Vite's hashed assets already skip the Worker
 * (`run_worker_first` in wrangler.jsonc) and are cached as immutable
 * (public/_headers), and new data is a new directory. The client gets the
 * directory and the list of files as `import.meta.env.REJ_ASSOCIATION_SHARDS`,
 * so a symbol without a file costs no request.
 */
function associationShards(): Plugin {
  const source = join(
    import.meta.dirname,
    'src/features/disease-associations/data/associations.json',
  )
  const shards = () =>
    buildAssociationShards(
      JSON.parse(readFileSync(source, 'utf8')) as AssociationData,
    )
  const files = (base: string) =>
    [...shards()].map(([key, data]) => ({
      path: associationShardUrl(base, key),
      key,
      body: JSON.stringify(data),
    }))
  // Named for the files themselves (keys and contents), so a change to the
  // data or to how it is split moves every URL.
  const hash = createHash('sha256')
  for (const file of files('')) hash.update(file.path).update(file.body)
  const manifest: AssociationShardManifest = {
    base: `/assets/disease-associations/${hash.digest('hex').slice(0, 12)}`,
    keys: files('').map((file) => file.key),
  }
  return {
    name: 'rej:association-shards',
    config: () => ({
      define: {
        'import.meta.env.REJ_ASSOCIATION_SHARDS': JSON.stringify(manifest),
      },
    }),
    generateBundle() {
      if (this.environment.name !== 'client') return
      for (const file of files(manifest.base)) {
        this.emitFile({
          type: 'asset',
          fileName: file.path.slice(1),
          source: file.body,
        })
      }
    },
    // Dev serves them from the JSON as it is now, under the directory named
    // at startup (restart the dev server after `pnpm data:associations`).
    configureServer(server) {
      server.middlewares.use(manifest.base, (request, response, next) => {
        const file = files(manifest.base).find(
          (f) => f.path === `${manifest.base}${request.url}`,
        )
        if (!file) return next()
        response.setHeader('content-type', 'application/json')
        response.end(file.body)
      })
    },
  }
}

/** The checked-out commit, or '' outside a git checkout. */
function gitHead(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

/**
 * What the Worker reports at /api/version. The Worker has no git and no
 * package.json at runtime, so the build inlines them; they are defined for
 * the Worker only, because a page has no use for them.
 */
function workerBuildInfo(): Plugin {
  return {
    name: 'rej:worker-build-info',
    configEnvironment(name) {
      if (name !== 'ssr') return
      const version = JSON.parse(
        readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'),
      ) as { version: string }
      return {
        define: {
          // CI passes GIT_COMMIT_SHA; a build run by hand asks git, so a
          // deploy from a laptop still says which commit it is. Blank is
          // treated as unset by the route, so a build outside a checkout
          // reports "unknown" rather than ''.
          'import.meta.env.REJ_GIT_COMMIT_SHA': JSON.stringify(
            process.env.GIT_COMMIT_SHA?.trim() || gitHead(),
          ),
          'import.meta.env.REJ_APP_VERSION': JSON.stringify(version.version),
          'import.meta.env.REJ_BUILD_TIMESTAMP': JSON.stringify(
            new Date().toISOString(),
          ),
        },
      }
    },
  }
}

/**
 * Uploads the client bundle's source maps to Sentry, so a minified stack
 * trace from the browser reads as source.
 *
 * Only when SENTRY_AUTH_TOKEN is in the build's environment: without it the
 * build runs exactly as it did before (the plugin is left out entirely, so
 * not even the debug-id injection happens). SENTRY_ORG and SENTRY_PROJECT
 * are read from the environment by the plugin itself.
 *
 * The maps stay beside the bundle as well — they are public by design
 * (`environments.client` above), so there is no `filesToDeleteAfterUpload`.
 * The Worker's maps are not uploaded here: wrangler uploads them to
 * Cloudflare, where its own observability reads them.
 */
function sentrySourceMaps(): Plugin[] {
  if (!process.env.SENTRY_AUTH_TOKEN) return []
  return sentryVitePlugin({
    telemetry: false,
    sourcemaps: { assets: ['dist/client/**/*.js', 'dist/client/**/*.js.map'] },
  }) as Plugin[]
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
    shellOrPageOnWorker(),
    workerBuildInfo(),
    clientChunkGraph(),
    mcpAppBridge(),
    associationShards(),
    tailwindcss(),
    tanstackStart({
      // SPA mode: the build prerenders an HTML shell (the root route, with
      // the router's pending component where a page would go), which the
      // Worker serves for every route that is not prerendered, and the
      // client renders those pages. The pages that render the same for
      // everyone are prerendered in full (src/server/prerendered-pages.ts),
      // so their content arrives with the HTML.
      spa: { enabled: true, prerender: { outputPath: SHELL_FILE } },
      // Only the listed pages: no following their links, no discovering
      // other routes (both on by default).
      prerender: { crawlLinks: false, autoStaticPathsDiscovery: false },
      pages: PRERENDERED_PAGES.map((path) => ({
        path: prerenderJobPath(path),
        prerender: { enabled: true, outputPath: prerenderedFile(path) },
      })),
    }),
    // After Start, as its docs require.
    react(),
    // React Compiler (automatic memoization), as next.config.ts's
    // `reactCompiler: true` did.
    babel({ presets: [reactCompilerPreset()] }),
    // Last, as Sentry's docs require.
    ...sentrySourceMaps(),
  ],
  lint: lintConfig,
})
