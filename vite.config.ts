import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { cloudflare } from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite-plus'

import { lintConfig } from './lint/config'
import {
  PRERENDERED_PAGES,
  SHELL_FILE,
  prerenderJobPath,
  prerenderedFile,
} from './src/server/prerendered-pages'
import { SERVER_FN_BASE, serverFnId } from './src/server/server-fns'

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
          // Blank is treated as unset by the route, so passing an empty
          // GIT_COMMIT_SHA reports "unknown" rather than ''.
          'import.meta.env.REJ_GIT_COMMIT_SHA': JSON.stringify(
            process.env.GIT_COMMIT_SHA ?? '',
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
      // Under /api/, behind the gate as an API, with ids a script can name
      // (src/server/server-fns.ts).
      serverFns: {
        base: SERVER_FN_BASE,
        generateFunctionId: ({ filename, functionName }) =>
          serverFnId(filename, functionName),
      },
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
  ],
  lint: lintConfig,
})
