.PHONY: dev build seed deploy-modal lint format type-check verify doctor

# ---------- Development ----------

dev: ## Start Next.js + FastAPI dev servers
	pnpm dev

build: ## Production build (Vercel target)
	pnpm build

# ---------- Database ----------

seed: ## Rebuild JSONL from CSV, push schema, and upload data
	pnpm db:build && pnpm db:push && pnpm db:upload

db-studio: ## Open Drizzle Studio
	pnpm db:studio

db-push: ## Push schema changes to $DATABASE_URL
	pnpm db:push

# ---------- Deploy ----------

deploy-modal: ## Deploy Python backend to Modal
	cd modal && modal deploy app.py

# ---------- Quality ----------

lint: ## Run ESLint
	pnpm lint

lint-fix: ## Auto-fix ESLint issues
	pnpm lint:fix

format: ## Run Prettier
	pnpm format

type-check: ## Run TypeScript type checker
	pnpm type-check

verify: ## Run full CI gate locally (lint, format, types, knip, build)
	pnpm verify

doctor: ## Check local environment health
	bash scripts/doctor.sh

# ---------- Codegen ----------

api-types: ## Regenerate TS types from FastAPI OpenAPI spec
	bash scripts/generate-api-types.sh

# ---------- Help ----------

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
