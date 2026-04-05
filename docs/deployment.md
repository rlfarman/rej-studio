# Deployment

REJ Studio can be deployed to either Vercel or Cloudflare Workers. The `DEPLOY_TARGET` env var selects target-specific config.

## Target differences

| Concern        | Vercel                                          | Cloudflare                                       |
| -------------- | ----------------------------------------------- | ------------------------------------------------ |
| Runtime        | Node.js + Python serverless functions           | Workers (V8) via `@opennextjs/cloudflare`        |
| Python backend | `api/index.py` (re-exports `python.index:app`)  | None — `COMPUTE_BACKEND=modal` is mandatory      |
| `/api/py/*`    | Rewritten to `/api/` (Python function)          | Not wired; requests hit Modal via server actions |
| Build command  | `pnpm build`                                    | `pnpm build:cf`                                  |
| Deploy command | `git push` (Vercel Git integration) or `vercel` | `pnpm deploy:cf` (via wrangler)                  |
| Env config     | Vercel dashboard / `vercel env`                 | `wrangler secret put <NAME>` + `wrangler.toml`   |

## Environment variables

Shared across both targets:

- `DATABASE_URL`
- `SESSION_SECRET`
- `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`
- `COMPUTE_BACKEND` (optional on Vercel, **required=`modal`** on Cloudflare)
- `MODAL_API_URL` (required when `COMPUTE_BACKEND=modal`)
- `APP_URL` (host-agnostic replacement for `VERCEL_URL`; optional on Vercel since `VERCEL_URL` is auto-set)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (optional)
- `MAINTENANCE_MESSAGE` (optional)

`DEPLOY_TARGET` is set at build time:

- Vercel: via `vercel.json` → `build.env.DEPLOY_TARGET=vercel`
- Cloudflare: via `pnpm build:cf` script (`DEPLOY_TARGET=cloudflare`) + `wrangler.toml` `[vars]`

## Deploying to Vercel

No extra steps beyond the normal Vercel workflow:

```bash
# First time: link project
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod
```

Or push to the branch configured in your Vercel Git integration.

## Deploying to Cloudflare

One-time setup:

```bash
# Authenticate (opens browser for OAuth)
npx wrangler login

# Set secrets (wrangler prompts for each value)
npx wrangler secret put DATABASE_URL
npx wrangler secret put SESSION_SECRET
npx wrangler secret put BASIC_AUTH_USER
npx wrangler secret put BASIC_AUTH_PASSWORD
npx wrangler secret put MODAL_API_URL
# Only if using GA:
npx wrangler secret put NEXT_PUBLIC_GA_MEASUREMENT_ID
```

Non-secret vars live in `wrangler.toml` `[vars]` — `DEPLOY_TARGET` and `COMPUTE_BACKEND=modal` are already set there.

Build and deploy:

```bash
pnpm build:cf         # emits .open-next/
pnpm preview:cf       # test locally via wrangler dev
pnpm deploy:cf        # ship to Workers
```

## When to switch

- **Vercel** — simplest; Python runs serverless alongside Next.js; no Modal dependency required.
- **Cloudflare** — cheaper at scale; global edge; but Python compute must move to Modal.

Switching between them is a config-only change — no source code touches required.
