import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  vector,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const pokemons = pgTable(
  'pokemon',
  {
    id: text('id')
      .primaryKey()
      .notNull()
      .$defaultFn(() => randomUUID()),
    number: integer('number').notNull(),
    name: text('name').notNull(),
    type1: text('type1').notNull(),
    type2: text('type2'),
    total: integer('total').notNull(),
    hp: integer('hp').notNull(),
    attack: integer('attack').notNull(),
    defense: integer('defense').notNull(),
    spAtk: integer('spAtk').notNull(),
    spDef: integer('spDef').notNull(),
    speed: integer('speed').notNull(),
    generation: integer('generation').notNull(),
    legendary: boolean('legendary').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => ({
    embeddingIndex: index().using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
  })
);

export type SelectPokemon = typeof pokemons.$inferSelect;

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
});

export type SelectGene = typeof genes.$inferSelect;

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
});

export type SelectIsoform = typeof isoforms.$inferSelect;
