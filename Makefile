.PHONY: dev build lint lint-fix format type-check verify doctor help

# ---------- Development ----------

dev: ## Start the TanStack Start dev server (vp dev, Worker in workerd)
	pnpm dev

build: ## Production build (TanStack Start + Cloudflare Worker, in dist/)
	pnpm build

# ---------- Deploy ----------
# The Python backend deploys from CI (.github/workflows/modal-deploy.yml) on
# merges to main, with the pinned image builder and locked Modal client. To
# redeploy by hand: gh workflow run modal-deploy.yml

# ---------- Quality ----------

lint: ## Run Oxlint (vp lint), with the boundary rules as JS plugins
	pnpm lint

lint-fix: ## Auto-fix lint issues
	pnpm lint:fix

format: ## Run Oxfmt
	pnpm format

type-check: ## Run TypeScript type checker
	pnpm type-check

verify: ## Lint, type-check and unit tests (the pre-push gate)
	pnpm verify

doctor: ## Check local environment health
	pnpm doctor

# ---------- Help ----------

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
