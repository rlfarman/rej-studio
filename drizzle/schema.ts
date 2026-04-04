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

export const transcriptResults = sqliteTable(
  'transcript_results',
  {
    transcriptId: text('transcript_id').primaryKey().notNull(),
    optimizationReportFilename: text('optimization_report_filename').notNull(),
    optimizationReportText: text('optimization_report_text').notNull(),
    rejFilename: text('rej_filename').notNull(),
    rejText: text('rej_text').notNull(),
    seq5: text('seq5').notNull(),
    seq3: text('seq3').notNull(),
    hasStimintron: integer('has_stimintron').notNull().default(0),
    ingestedAt: text('ingested_at').notNull(),
    contentSha256: text('content_sha256'),
  },
  (table) => [
    index('idx_transcript_results_ingested_at').on(table.ingestedAt),
  ],
)

export type SelectTranscriptResult = typeof transcriptResults.$inferSelect
