# Deployment

REJ Studio can be deployed to either Vercel or Cloudflare Workers for the Next.js frontend. The Python backend always runs on Modal in production — `COMPUTE_BACKEND=modal` is required on both hosts. The `DEPLOY_TARGET` env var selects frontend target-specific config.

## Target differences

| Concern        | Vercel                                          | Cloudflare                                     |
| -------------- | ----------------------------------------------- | ---------------------------------------------- |
| Runtime        | Node.js serverless functions                    | Workers (V8) via `@opennextjs/cloudflare`      |
| Python backend | Modal (required) — called from server actions   | Modal (required) — called from server actions  |
| `/api/py/*`    | Not wired in prod; proxied to uvicorn in dev    | Not wired in prod; proxied to uvicorn in dev   |
| Build command  | `pnpm build`                                    | `pnpm build:cf`                                |
| Deploy command | `git push` (Vercel Git integration) or `vercel` | `pnpm deploy:cf` (via wrangler)                |
| Env config     | Vercel dashboard / `vercel env`                 | `wrangler secret put <NAME>` + `wrangler.toml` |

## Environment variables

Shared across both targets:

- `DATABASE_URL`
- `SESSION_SECRET`
- `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`
- `COMPUTE_BACKEND` — **required=`modal`** in production on both Vercel and Cloudflare
- `MODAL_API_URL` — required (since `COMPUTE_BACKEND=modal` is required)
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

Both hosts serve only the Next.js frontend; Python compute runs on Modal in both cases.

- **Vercel** — tightest Next.js integration, simplest dashboard + previews.
- **Cloudflare** — cheaper at scale; global edge.

Switching between them is a config-only change — no source code touches required.
