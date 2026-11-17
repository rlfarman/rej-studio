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
   * The Cloudflare Access team (`team.cloudflareaccess.com`) and this
   * application's AUD tag. Both or neither: with neither, /api/designs answers
   * 503; set at cutover (./designs/access.ts).
   */
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  /**
   * Local development only: the email to treat a loopback request as, in
   * place of an Access token. Never set on a deployed Worker
   * (./designs/access.ts ignores it off localhost anyway).
   */
  DEV_ACCESS_EMAIL?: string
}
