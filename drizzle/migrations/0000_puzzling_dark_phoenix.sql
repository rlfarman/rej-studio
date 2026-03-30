CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gene_id" text NOT NULL,
	"isoform_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genes" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"alternate_symbols" text[],
	"name" text NOT NULL,
	"ENSG" text NOT NULL,
	"species" text DEFAULT '' NOT NULL,
	"chromosome" text,
	"disease_associations" text[]
);
--> statement-breakpoint
CREATE TABLE "isoforms" (
	"id" text PRIMARY KEY NOT NULL,
	"geneId" text NOT NULL,
	"ENST" text NOT NULL,
	"coding_sequence_length" integer NOT NULL,
	"protein_sequence_length" integer DEFAULT 0 NOT NULL,
	"species" text NOT NULL,
	"coding_sequence" text DEFAULT '' NOT NULL,
	"protein_sequence" text DEFAULT '' NOT NULL,
	"default_three_prime_sequence" text DEFAULT '' NOT NULL,
	"default_five_prime_sequence" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"sequence" text NOT NULL,
	"options" text NOT NULL,
	"status" text NOT NULL,
	"errorMessage" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"gene_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"isoform_id" text PRIMARY KEY NOT NULL,
	"sequence" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_gene_id_genes_id_fk" FOREIGN KEY ("gene_id") REFERENCES "public"."genes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_isoform_id_isoforms_id_fk" FOREIGN KEY ("isoform_id") REFERENCES "public"."isoforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isoforms" ADD CONSTRAINT "isoforms_geneId_genes_id_fk" FOREIGN KEY ("geneId") REFERENCES "public"."genes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_gene_id_genes_id_fk" FOREIGN KEY ("gene_id") REFERENCES "public"."genes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_isoform_id_isoforms_id_fk" FOREIGN KEY ("isoform_id") REFERENCES "public"."isoforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_user_id_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "favorites_user_gene_idx" ON "favorites" USING btree ("user_id","gene_id");--> statement-breakpoint
CREATE INDEX "genes_symbol_idx" ON "genes" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "genes_name_idx" ON "genes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "genes_ensg_idx" ON "genes" USING btree ("ENSG");--> statement-breakpoint
CREATE INDEX "isoforms_gene_id_idx" ON "isoforms" USING btree ("geneId");--> statement-breakpoint
CREATE INDEX "isoforms_enst_idx" ON "isoforms" USING btree ("ENST");--> statement-breakpoint
CREATE INDEX "searches_user_id_idx" ON "searches" USING btree ("user_id");