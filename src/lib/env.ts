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

    // Postgres — required everywhere (read-only app data).
    DATABASE_URL: z.string().url(),

    // Compute backend. In production, must be "modal". In dev, "local" (or
    // unset) falls through to the uvicorn dev server.
    COMPUTE_BACKEND: z.enum(['modal', 'local']).optional(),
    MODAL_API_URL: z.string().url().optional(),
    LOCAL_API_URL: z.string().url().optional(),

    // Deploy target — drives target-specific next.config behavior.
    DEPLOY_TARGET: z.enum(['vercel', 'cloudflare']).optional(),

    // Landing-page basic auth (optional — gate only engages when both set).
    BASIC_AUTH_USER: z.string().optional(),
    BASIC_AUTH_PASSWORD: z.string().optional(),

    // Vercel Blob (optional — only needed when file uploads are used).
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

    // Maintenance banner — when set, shows amber banner site-wide.
    MAINTENANCE_MESSAGE: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Production guardrails: modal backend is mandatory, and it needs a URL.
    if (isProd) {
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

const clientSchema = z.object({
  // Client-exposed vars must be prefixed with NEXT_PUBLIC_ so Next inlines them.
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, 'Expected GA4 measurement ID like "G-XXXXXXXXXX".')
    .optional(),
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
