import { integer, pgTable, text, vector } from 'drizzle-orm/pg-core'
import { randomUUID } from 'crypto'

export const genes = pgTable('genes', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => randomUUID()),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  ENSG: text('ENSG').notNull(),
  chromosome: text('chromosome').notNull(),
  diseaseAssociations: text('diseaseAssociations').array(),
  embedding: vector('embedding', { dimensions: 1536 }),
})

export type SelectGene = typeof genes.$inferSelect

export const isoforms = pgTable('isoforms', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => randomUUID()),
  geneId: text('geneId')
    .notNull()
    .references(() => genes.id),
  ENST: text('ENST').notNull(),
  length: integer('length').notNull(),
  packagability: integer('packagability').notNull(),
  species: text('species').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
})

export const sequences = pgTable('sequences', {
  isoformId: text('isoform_id')
    .notNull()
    .references(() => isoforms.id)
    .primaryKey(),

  sequence: text('sequence').notNull(),
})

export type SelectIsoform = typeof isoforms.$inferSelect
