import { z } from 'zod'

/**
 * Centralized, Zod-validated environment variables.
 *
 * Import `env` instead of reading `process.env` directly so that:
 *   - Typos and missing vars fail fast at boot with a clear error
 *   - Types are derived from the schema (no `string | undefined` noise)
 *   - Dev-only vs. production-required is encoded in one place
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
    MODAL_API_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),
    LOCAL_API_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),

    // Deploy target — drives target-specific next.config behavior.
    DEPLOY_TARGET: z.enum(['vercel', 'cloudflare']).optional(),

    // Landing-page basic auth (optional — gate only engages when both set).
    BASIC_AUTH_USER: z.string().optional(),
    BASIC_AUTH_PASSWORD: z.string().optional(),

    // Vercel Blob (optional — only needed when file uploads are used).
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

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
      if (!data.DATABASE_URL || !data.DATABASE_URL.startsWith('postgres')) {
        ctx.addIssue({
          path: ['DATABASE_URL'],
          code: z.ZodIssueCode.custom,
          message:
            'DATABASE_URL must be a Postgres connection string in production (PGlite is dev-only).',
        })
      }
      if (data.COMPUTE_BACKEND !== 'modal') {
        ctx.addIssue({
          path: ['COMPUTE_BACKEND'],
          code: z.ZodIssueCode.custom,
          message:
            'COMPUTE_BACKEND=modal is required in production (Vercel and Cloudflare have no Python runtime).',
        })
      }
      if (!data.MODAL_API_URL) {
        ctx.addIssue({
          path: ['MODAL_API_URL'],
          code: z.ZodIssueCode.custom,
          message:
            'MODAL_API_URL is required when COMPUTE_BACKEND=modal (production).',
        })
      }
    }
    // If the user set COMPUTE_BACKEND=modal anywhere, they must also set MODAL_API_URL.
    if (data.COMPUTE_BACKEND === 'modal' && !data.MODAL_API_URL) {
      ctx.addIssue({
        path: ['MODAL_API_URL'],
        code: z.ZodIssueCode.custom,
        message: 'MODAL_API_URL is required when COMPUTE_BACKEND=modal.',
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
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

    // Canonical site URL for metadata, OG images, sitemap, and robots.txt.
    // Required in production to prevent hardcoded fallback from silently
    // serving the wrong URL. In dev, defaults to https://rejstudio.com.
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (isProd && !data.NEXT_PUBLIC_SITE_URL) {
      ctx.addIssue({
        path: ['NEXT_PUBLIC_SITE_URL'],
        code: z.ZodIssueCode.custom,
        message:
          'NEXT_PUBLIC_SITE_URL is required in production to ensure correct canonical URLs, OG images, and sitemap entries.',
      })
    }
  })

function parseEnv() {
  const serverResult = serverSchema.safeParse(process.env)
  const clientResult = clientSchema.safeParse(process.env)

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

  return { ...serverResult.data, ...clientResult.data }
}

export const env = parseEnv()
export type Env = typeof env
