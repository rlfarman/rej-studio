import 'server-only'
import { z } from 'zod'

/**
 * Centralized, Zod-validated environment variables.
 *
 * Import `env` instead of reading `process.env` directly so that:
 *   - Typos and missing vars fail fast at boot with a clear error
 *   - Types are derived from the schema (no `string | undefined` noise)
 *   - Dev-only vs. production-required is encoded in one place
 *
 * Server-only: the object includes secrets, so importing it from a Client
 * Component fails the build. Client code reads NEXT_PUBLIC_* vars directly.
 */

const isProd = process.env.NODE_ENV === 'production'

const serverSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // Database connection. In production, a Neon Postgres URL. In development,
    // can be a Neon URL, a file path for PGlite ('file:./data/local.db'),
    // 'memory://' for in-memory PGlite, or empty to default to PGlite at
    // ./data/local.db. PGlite is embedded Postgres — full SQL compatibility.
    DATABASE_URL: z.string().default(''),

    // Compute backend. In production, must be "modal". In dev, "local" (or
    // unset) falls through to the uvicorn dev server.
    COMPUTE_BACKEND: z.enum(['modal', 'local']).optional(),
    MODAL_API_URL: z.url().optional(),
    // Bearer token the server sends to the Modal endpoint, so the optimizer
    // isn't callable by anyone who learns its URL. Optional for now; a
    // production deploy without it logs a warning (see parseEnv).
    MODAL_API_TOKEN: z.string().optional(),
    LOCAL_API_URL: z.url().optional(),

    // Shared-password auth for the site. Gate only engages when
    // BASIC_AUTH_PASSWORD is set; SESSION_SECRET is then required so we can
    // sign the session cookie.
    BASIC_AUTH_PASSWORD: z.string().optional(),
    SESSION_SECRET: z.string().min(32).optional(),

    // Maintenance banner — when set, shows amber banner site-wide.
    MAINTENANCE_MESSAGE: z.string().optional(),

    // Health endpoint auth — when set, full check details require this token.
    HEALTH_AUTH_TOKEN: z.string().optional(),

    // Sentry (server-side org/project for source-map uploads).
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Production guardrails.
    if (isProd) {
      // Gene data comes from Postgres until a static corpus is configured.
      if (
        !process.env.NEXT_PUBLIC_GENE_DATA_URL &&
        (!data.DATABASE_URL || !data.DATABASE_URL.startsWith('postgres'))
      ) {
        ctx.addIssue({
          path: ['DATABASE_URL'],
          code: 'custom',
          message:
            'DATABASE_URL must be a Postgres connection string in production (PGlite is dev-only), unless NEXT_PUBLIC_GENE_DATA_URL points at a static gene corpus.',
        })
      }
      if (data.COMPUTE_BACKEND !== 'modal') {
        ctx.addIssue({
          path: ['COMPUTE_BACKEND'],
          code: 'custom',
          message:
            'COMPUTE_BACKEND=modal is required in production (Vercel has no Python runtime).',
        })
      }
      if (!data.MODAL_API_URL) {
        ctx.addIssue({
          path: ['MODAL_API_URL'],
          code: 'custom',
          message:
            'MODAL_API_URL is required when COMPUTE_BACKEND=modal (production).',
        })
      }
    }
    // If the user set COMPUTE_BACKEND=modal anywhere, they must also set MODAL_API_URL.
    if (data.COMPUTE_BACKEND === 'modal' && !data.MODAL_API_URL) {
      ctx.addIssue({
        path: ['MODAL_API_URL'],
        code: 'custom',
        message: 'MODAL_API_URL is required when COMPUTE_BACKEND=modal.',
      })
    }
    // SESSION_SECRET is required whenever the shared-password gate is enabled.
    if (data.BASIC_AUTH_PASSWORD && !data.SESSION_SECRET) {
      ctx.addIssue({
        path: ['SESSION_SECRET'],
        code: 'custom',
        message:
          'SESSION_SECRET (32+ chars) is required when BASIC_AUTH_PASSWORD is set.',
      })
    }
  })

const clientSchema = z
  .object({
    // Client-exposed vars must be prefixed with NEXT_PUBLIC_ so Next inlines them.
    NEXT_PUBLIC_GTM_ID: z
      .string()
      .regex(/^GTM-[A-Z0-9]+$/, 'Expected GTM container ID like "GTM-XXXXXXX".')
      .optional(),

    // Sentry DSN (client-side). When unset, Sentry is not initialised.
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),

    // Canonical site URL for metadata, OG images, sitemap, and robots.txt.
    // Required in production to prevent hardcoded fallback from silently
    // serving the wrong URL. In dev, defaults to https://rejstudio.com.
    NEXT_PUBLIC_SITE_URL: z.url().optional(),

    // Feature flag: enable the experimental multi-split (two split points)
    // UI in the design tool. Hidden by default for the preview release; the
    // data layer already supports two positions. Client code reads this
    // directly via process.env (see features/design-tool/utils/feature-flags.ts).
    NEXT_PUBLIC_ENABLE_MULTI_SPLIT: z.enum(['true', 'false']).optional(),

    // Feature flag: run the optimizer in a Web Worker rather than on the
    // compute backend. Client code reads it directly via process.env (see
    // features/design-tool/utils/feature-flags.ts).
    NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER: z.enum(['true', 'false']).optional(),

    // Base URL of one version of the static gene corpus (built by
    // `pnpm corpus:build`): an absolute URL, or a path served from public/.
    // Unset, development uses the committed sample and production keeps
    // reading Postgres. Read directly via process.env (see
    // features/gene-search/corpus/gene-data-url.ts).
    NEXT_PUBLIC_GENE_DATA_URL: z
      .string()
      .regex(
        /^(https?:\/\/|\/)/,
        'Expected an http(s) URL or a path starting with "/".',
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (isProd && !data.NEXT_PUBLIC_SITE_URL) {
      ctx.addIssue({
        path: ['NEXT_PUBLIC_SITE_URL'],
        code: 'custom',
        message:
          'NEXT_PUBLIC_SITE_URL is required in production to ensure correct canonical URLs, OG images, and sitemap entries.',
      })
    }
  })

function parseEnv() {
  // A blank `FOO=` line (as in .env.example) means unset, not "": otherwise
  // every optional enum, URL and min-length check rejects the empty string.
  const source = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  )
  const serverResult = serverSchema.safeParse(source)
  const clientResult = clientSchema.safeParse(source)

  if (!serverResult.success || !clientResult.success) {
    const issues = [
      ...(serverResult.success ? [] : serverResult.error.issues),
      ...(clientResult.success ? [] : clientResult.error.issues),
    ]
    const formatted = issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    // Fail loudly at module load. Next will surface this in the build log
    // (prod) or the dev server terminal (dev).
    throw new Error(
      `Environment validation failed:\n${formatted}\n\nSee .env.example for the expected shape.`,
    )
  }

  const env = { ...serverResult.data, ...clientResult.data }

  // Warn rather than fail: the Modal endpoint can't require the token until
  // every deploy sends one, and failing here would break those builds.
  if (isProd && env.COMPUTE_BACKEND === 'modal' && !env.MODAL_API_TOKEN) {
    console.warn(
      '[env] MODAL_API_TOKEN is not set: requests to MODAL_API_URL are unauthenticated.',
    )
  }

  return env
}

export const env = parseEnv()
export type Env = typeof env
