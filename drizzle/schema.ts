import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const genes = sqliteTable(
  'genes',
  {
    id: text('id').primaryKey().notNull(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    species: text('species').notNull(),
    alternateSymbols: text('alternate_symbols'),
  },
  (table) => [
    index('idx_genes_symbol').on(table.symbol),
    index('idx_genes_name').on(table.name),
    index('idx_genes_species').on(table.species),
  ],
)

export type SelectGene = typeof genes.$inferSelect

export const isoforms = sqliteTable(
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
