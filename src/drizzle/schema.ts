import { pgTable, text, integer, index, customType } from 'drizzle-orm/pg-core'

// Custom type for Postgres tsvector columns. Drizzle doesn't have a built-in
// tsvector type, but we can define one that maps to the correct SQL.
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

// alternateSymbols is pipe-delimited (e.g. "|Abca1|Cerp|Tgd|") so search queries
// can use a plain LOWER(col) LIKE '%query%' pattern that works in any SQL dialect.
// Parse with parseAlternateSymbols() from @/lib/bio/gene-symbols for display.
// Original casing is preserved.

export const genes = pgTable(
  'genes',
  {
    id: text('id').primaryKey().notNull(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    species: text('species').notNull(),
    alternateSymbols: text('alternate_symbols').notNull().default(''),
    // Full-text search vector. Populated by a trigger or during seed.
    // Combines symbol (weight A), name (weight B), and alternateSymbols (weight C)
    // for ranked full-text search via GIN index.
    searchVector: tsvector('search_vector'),
  },
  (table) => [
    index('idx_genes_symbol').on(table.symbol),
    index('idx_genes_name').on(table.name),
    index('idx_genes_species').on(table.species),
    index('idx_genes_search_vector').using('gin', table.searchVector),
  ],
)

export type SelectGene = typeof genes.$inferSelect

export const isoforms = pgTable(
  'isoforms',
  {
    id: text('id').primaryKey().notNull(),
    geneId: text('gene_id')
      .notNull()
      .references(() => genes.id),
    codingSequenceLength: integer('coding_sequence_length').notNull(),
    proteinSequenceLength: integer('protein_length').notNull(),
    codingSequence: text('coding_sequence').notNull().default(''),
    proteinSequence: text('protein_sequence').notNull().default(''),
    species: text('species').notNull(),
  },
  (table) => [index('idx_isoforms_gene_id').on(table.geneId)],
)

export type SelectIsoform = typeof isoforms.$inferSelect
