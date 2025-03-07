CREATE TABLE IF NOT EXISTS "pokemon" (
	"id" text PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"type1" text NOT NULL,
	"type2" text,
	"total" integer NOT NULL,
	"hp" integer NOT NULL,
	"attack" integer NOT NULL,
	"defense" integer NOT NULL,
	"spAtk" integer NOT NULL,
	"spDef" integer NOT NULL,
	"speed" integer NOT NULL,
	"generation" integer NOT NULL,
	"legendary" boolean NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pokemon_embedding_index" ON "pokemon" USING hnsw ("embedding" vector_cosine_ops);