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
}
