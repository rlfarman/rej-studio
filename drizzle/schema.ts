import {
  integer,
  pgTable,
  text,
  vector,
  timestamp,
  serial,
} from 'drizzle-orm/pg-core'
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
  diseaseAssociations: text('disease_associations').array(),
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

export const jobs = pgTable('jobs', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sequence: text('sequence').notNull(),
  status: text('status')
    .notNull()
    .$default(() => 'pending'), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text('errorMessage'), // If the job fails, store the error message
  // parameters: jsonb('parameters').notNull(), // Algorithm parameters (JSON)
  // result: jsonb('result'), // Stores computed result (JSON) or a reference to an external file
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type SelectJob = typeof jobs.$inferSelect

export const sessions = pgTable('sessions', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => randomUUID()),
  userId: text('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at')
    .notNull()
    .$defaultFn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
})

export type SelectSession = typeof sessions.$inferSelect

export const searches = pgTable('searches', {
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
})

// Create favorites table for users to track favorite genes and favorite isoforms

export const favorites = pgTable('favorites', {
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
})

export type SelectFavorite = typeof favorites.$inferSelect
