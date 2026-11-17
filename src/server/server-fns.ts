/**
 * Where the app's server functions (`createServerFn`) are served, and what
 * they are called. Shared by vite.config.ts (which configures Start with it),
 * the passcode gate and the Worker smoke test.
 *
 * Under `/api/` on purpose, rather than Start's default `/_serverFn`: every
 * `/api/*` request already reaches the Worker first (wrangler.jsonc), is
 * handed to Start by worker-entry.ts, and, signed out, gets the gate's 401
 * JSON rather than the login redirect a page load gets.
 */
export const SERVER_FN_BASE = '/api/fn'

/**
 * A server function's id in a production build: the file's name without its
 * `.functions.ts` suffix, and the export, e.g.
 * `cloud-designs.submitCloudDesignFn`. Start's default is a SHA-256 of the
 * file's path, which nothing outside the build can name; a readable, stable
 * id lets scripts/smoke-worker.mjs call the deployed shape over HTTP. It is
 * not a secret either way: the client bundle carries it. (`vp dev` uses
 * Start's own encoded ids regardless.)
 */
export function serverFnId(filename: string, functionName: string): string {
  const file = filename
    .split(/[\\/]/)
    .pop()!
    .replace(/(\.functions)?\.[cm]?[jt]sx?$/, '')
  // Start names the extracted handler `<export>_createServerFn_handler`.
  const name = functionName.replace(/_createServerFn_handler$/, '')
  return `${file}.${name}`
}
