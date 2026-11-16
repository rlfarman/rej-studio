-- Substring search (`lower(col) LIKE '%q%'`) needs trigram GIN indexes; a
-- btree can't serve a leading wildcard. pg_trgm ships with Neon and with
-- PGlite (loaded in src/drizzle/client.ts). Statements are idempotent so
-- this also applies cleanly to a database built with `drizzle-kit push`.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- No query filters or sorts on these columns.
DROP INDEX IF EXISTS "idx_genes_name";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_isoforms_species";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_isoforms_cds_length";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_genes_symbol_lower" ON "genes" USING btree (lower("symbol"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_genes_symbol_trgm" ON "genes" USING gin (lower("symbol") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_genes_name_trgm" ON "genes" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_genes_alternate_symbols_trgm" ON "genes" USING gin (lower("alternate_symbols") gin_trgm_ops);
