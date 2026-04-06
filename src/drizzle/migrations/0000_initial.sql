CREATE TABLE "genes" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"alternate_symbols" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "isoforms" (
	"id" text PRIMARY KEY NOT NULL,
	"gene_id" text NOT NULL,
	"coding_sequence_length" integer NOT NULL,
	"protein_length" integer NOT NULL,
	"coding_sequence" text DEFAULT '' NOT NULL,
	"protein_sequence" text DEFAULT '' NOT NULL,
	"species" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "isoforms" ADD CONSTRAINT "isoforms_gene_id_genes_id_fk" FOREIGN KEY ("gene_id") REFERENCES "public"."genes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_genes_symbol" ON "genes" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_genes_name" ON "genes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_genes_species" ON "genes" USING btree ("species");--> statement-breakpoint
CREATE INDEX "idx_genes_search_vector" ON "genes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "idx_isoforms_gene_id" ON "isoforms" USING btree ("gene_id");--> statement-breakpoint
CREATE INDEX "idx_isoforms_species" ON "isoforms" USING btree ("species");--> statement-breakpoint
CREATE INDEX "idx_isoforms_cds_length" ON "isoforms" USING btree ("coding_sequence_length");