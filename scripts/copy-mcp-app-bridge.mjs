/**
 * Copies the MCP Apps client library into public/, so the view that runs
 * inside a chat host can load it.
 *
 * The view is HTML delivered through the protocol, not a page of this app: it
 * has no build of its own, and the bundler cannot reach into it. Inlining the
 * library would repeat half a megabyte in every resource read, so it is served
 * as a static asset instead and the view names this origin in its content
 * security policy.
 *
 * Runs before every build and after every install. The copy is gitignored,
 * because it is a build product of a pinned dependency.
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = resolve(root, 'public/mcp/app-bridge.js')

// The dependency-free browser build, by its published entry point.
const source = require.resolve('@modelcontextprotocol/ext-apps/app-with-deps')

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)
console.log(`[mcp] app bridge -> ${destination.slice(root.length + 1)}`)
