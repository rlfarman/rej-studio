import { pgTable, text, integer, index } from 'drizzle-orm/pg-core'

// alternateSymbols is pipe-delimited (e.g. "|Abca1|Cerp|Tgd|") so search queries
// can use a plain LOWER(col) LIKE '%query%' pattern that works in any SQL dialect.
// Original casing is preserved.

export const genes = pgTable(
  'genes',
  {
    id: text('id').primaryKey().notNull(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    species: text('species').notNull(),
    alternateSymbols: text('alternate_symbols').notNull().default(''),
  },
  (table) => [
    index('idx_genes_symbol').on(table.symbol),
    index('idx_genes_name').on(table.name),
    index('idx_genes_species').on(table.species),
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
  (table) => [
    index('idx_isoforms_gene_id').on(table.geneId),
    index('idx_isoforms_species').on(table.species),
    index('idx_isoforms_cds_length').on(table.codingSequenceLength),
  ],
)

export type SelectIsoform = typeof isoforms.$inferSelect
