/**
 * What the Worker is given: the bindings `wrangler types` generates from
 * wrangler.jsonc (`Env`, in worker-configuration.d.ts), plus what isn't
 * declared there yet.
 *
 * Handlers take this as a parameter rather than importing
 * `cloudflare:workers` themselves, so they run under plain Vitest with a
 * hand-built env; only the route files in src/routes/api/ read the real one.
 */
export interface ServerEnv extends Partial<Env> {
  /**
   * The corpus bucket. Bound at cutover (wrangler.jsonc has it commented
   * out until the bucket exists), so optional: without it the Worker reads
   * gene data over HTTP or from its static assets (./gene-data.ts).
   */
  GENE_DATA?: R2Bucket
  /**
   * Named bearer tokens for /api/mcp, `name:secret,name:secret`. A secret:
   * `.dev.vars` locally, `wrangler secret put` when deployed. Unset, the
   * endpoint refuses every request (./mcp/tokens.ts).
   */
  MCP_TOKENS?: string
  /** Unlocks /api/health's deep check (./health.ts). A secret. */
  HEALTH_AUTH_TOKEN?: string
  /**
   * Where large cloud-design results go (over ~900 KB, more than a Workflow
   * step may return). Bound at cutover with the other buckets, so optional:
   * without it such a design fails with a clear message (./designs/run.ts).
   */
  DESIGN_RESULTS?: R2Bucket
  /**
   * The passcode gate (./auth/). A secret each; set both, or neither for
   * local development, where only loopback requests get through. One
   * without the other refuses everything.
   */
  BASIC_AUTH_PASSWORD?: string
  /** 32+ characters; signs the session cookie, keyed with the passcode. */
  SESSION_SECRET?: string
  /**
   * Where the Worker reports errors and traces (./sentry.ts). A plain `vars`
   * entry in wrangler.jsonc rather than a secret — a DSN is public. Unset
   * (local development, the worker smoke test), Sentry is off.
   */
  SENTRY_DSN?: string
  /**
   * Accounts (./accounts/): signs and encrypts Better Auth's cookies and
   * tokens. A secret, 32+ characters. Without it accounts are off, except in
   * local development with no passcode, which uses a fixed local secret.
   */
  BETTER_AUTH_SECRET?: string
  /** "Sign in with Google": both, or the button is not offered. Secrets. */
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /**
   * `true` keeps the last sign-in code sent to each address in memory, for
   * the end-to-end tests to read back (./accounts/dev-mailbox.ts). Set only
   * by Playwright; the read is refused for anything but a loopback request.
   */
  AUTH_DEV_MAILBOX?: string
}
