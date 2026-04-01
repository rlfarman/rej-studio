import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { randomUUID } from 'crypto'

export const genes = pgTable(
  'genes',
  {
    id: text('id')
      .primaryKey()
      .notNull()
      .$defaultFn(() => randomUUID()),
    symbol: text('symbol').notNull(),
    alternateSymbols: text('alternate_symbols').array(),
    name: text('name').notNull(),
    ENSG: text('ENSG').notNull(),
    species: text('species').notNull().default(''),
    chromosome: text('chromosome'),
    diseaseAssociations: text('disease_associations').array(),
  },
  (table) => [
    index('genes_symbol_idx').on(table.symbol),
    index('genes_name_idx').on(table.name),
    index('genes_ensg_idx').on(table.ENSG),
  ],
)

export type SelectGene = typeof genes.$inferSelect

export const isoforms = pgTable(
  'isoforms',
  {
    id: text('id')
      .primaryKey()
      .notNull()
      .$defaultFn(() => randomUUID()),
    geneId: text('geneId')
      .notNull()
      .references(() => genes.id),
    ENST: text('ENST').notNull(),
    codingSequenceLength: integer('coding_sequence_length').notNull(),
    proteinSequenceLength: integer('protein_sequence_length')
      .notNull()
      .default(0),
    species: text('species').notNull(),
    codingSequence: text('coding_sequence').notNull().default(''),
    proteinSequence: text('protein_sequence').notNull().default(''),
    defaultThreePrimeSequence: text('default_three_prime_sequence')
      .notNull()
      .default(''),
    defaultFivePrimeSequence: text('default_five_prime_sequence')
      .notNull()
      .default(''),
  },
  (table) => [
    index('isoforms_gene_id_idx').on(table.geneId),
    index('isoforms_enst_idx').on(table.ENST),
  ],
)

export type SelectIsoform = typeof isoforms.$inferSelect

export const sequences = pgTable('sequences', {
  isoformId: text('isoform_id')
    .notNull()
    .references(() => isoforms.id)
    .primaryKey(),
  sequence: text('sequence').notNull(),
})

export type SelectSequence = typeof sequences.$inferSelect

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type SelectUser = typeof users.$inferSelect


export const sessions = pgTable('sessions', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at')
    .notNull()
    .$defaultFn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
})

export type SelectSession = typeof sessions.$inferSelect

export const searches = pgTable(
  'searches',
  {
    id: text('id')
      .primaryKey()
      .notNull()
      .$defaultFn(() => randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    geneId: text('gene_id')
      .notNull()
      .references(() => genes.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('searches_user_id_idx').on(table.userId)],
)

export const favorites = pgTable(
  'favorites',
  {
    id: text('id')
      .primaryKey()
      .notNull()
      .$defaultFn(() => randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    geneId: text('gene_id')
      .notNull()
      .references(() => genes.id),
    isoformId: text('isoform_id').references(() => isoforms.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('favorites_user_id_idx').on(table.userId),
    index('favorites_user_gene_idx').on(table.userId, table.geneId),
  ],
)

export type SelectFavorite = typeof favorites.$inferSelect
