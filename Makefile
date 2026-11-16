.PHONY: dev build seed db-studio db-migrate lint lint-fix format type-check verify doctor api-types help

# ---------- Development ----------

dev: ## Start Next.js + FastAPI dev servers
	pnpm dev

build: ## Production build (Vercel target)
	pnpm build

# ---------- Database ----------

seed: ## Rebuild JSONL from CSV, apply migrations, and upload data
	pnpm db:build && pnpm db:migrate && pnpm db:upload

db-studio: ## Open Drizzle Studio
	pnpm db:studio

db-migrate: ## Apply committed migrations to $DATABASE_URL
	pnpm db:migrate

# ---------- Deploy ----------
# The Python backend deploys from CI (.github/workflows/modal-deploy.yml) on
# merges to main, with the pinned image builder and locked Modal client. To
# redeploy by hand: gh workflow run modal-deploy.yml

# ---------- Quality ----------

lint: ## Run Oxlint, then ESLint
	pnpm lint

lint-fix: ## Auto-fix lint issues
	pnpm lint:fix

format: ## Run Prettier
	pnpm format

type-check: ## Run TypeScript type checker
	pnpm type-check

verify: ## Lint, type-check and unit tests (the pre-push gate)
	pnpm verify

doctor: ## Check local environment health
	pnpm doctor

# ---------- Codegen ----------

api-types: ## Regenerate TS types from FastAPI OpenAPI spec
	bash scripts/generate-api-types.sh

# ---------- Help ----------

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
